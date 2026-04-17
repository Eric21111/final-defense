const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const WORKSPACE = path.resolve(__dirname, "..", "..");
const POS_ROOT = path.join(WORKSPACE, "pos");
const OUT_TXT = path.join(WORKSPACE, "Source_code.txt");

const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".expo",
  "coverage",
  "__pycache__",
]);
const EXCLUDE_EXT = new Set([
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".lock",
  ".ttf",
  ".woff",
  ".woff2",
  ".eot",
]);
const INCLUDE_EXT = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".ps1",
  ".bat",
]);

const SEP =
  "================================================================================";

function shouldSkipFile(relPosix, fullPath) {
  const base = path.basename(fullPath);
  if (base === "package-lock.json") return true;
  if (base.startsWith(".env")) return true;
  if (relPosix.includes("/.env")) return true;
  const ext = path.extname(fullPath).toLowerCase();
  if (ext && EXCLUDE_EXT.has(ext)) return true;
  if (!INCLUDE_EXT.has(ext)) return true;
  try {
    const buf = fs.readFileSync(fullPath);
    if (buf.includes(0)) return true;
  } catch {
    return true;
  }
  return false;
}

function collectFiles(dir, baseRel = "") {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (name === ".git" || name === "node_modules") continue;
    const full = path.join(dir, name);
    const rel = baseRel ? `${baseRel}/${name}` : name;
    const relPosix = rel.split(path.sep).join("/");
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      out.push(...collectFiles(full, relPosix));
    } else if (ent.isFile()) {
      if (!shouldSkipFile(relPosix, full)) out.push({ full, rel: relPosix });
    }
  }
  return out;
}

function redact(text, { isEnvStyle } = {}) {
  let s = text;
  s = s.replace(/mongodb(\+srv)?:\/\/[^\s'"`]+/gi, "mongodb://[REDACTED]");
  s = s.replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED]");
  s = s.replace(/sk_(live|test)_[a-zA-Z0-9]+/gi, "[REDACTED]");
  s = s.replace(/pk_(live|test)_[a-zA-Z0-9]+/gi, "[REDACTED]");
  s = s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]");
  s = s.replace(/Bearer\s+[A-Za-z0-9._\-\s]+/gi, "Bearer [REDACTED]");
  s = s.replace(/(['"`])xox[baprs]-[A-Za-z0-9-]+/gi, "$1[REDACTED]");
  if (isEnvStyle) {
    s = s.replace(/^([A-Z][A-Z0-9_]*)=(.*)$/gm, (line, key) => {
      if (
        /KEY|SECRET|TOKEN|PASSWORD|PASS|URI|PRIVATE|CREDENTIAL|AUTH|WEBHOOK/i.test(
          key
        )
      ) {
        return `${key}=[REDACTED]`;
      }
      return line;
    });
  }
  return s;
}

function stripPs1Comments(src) {
  let s = src.replace(/<#[\s\S]*?#>/g, "");
  return s.replace(/^\s*#.*$/gm, "");
}

function stripBatComments(src) {
  return src
    .replace(/^\s*::.*$/gm, "")
    .replace(/^\s*rem\s+.*$/gim, "");
}

function stripCommentsEsbuild(src, ext) {
  const loader =
    ext === ".tsx"
      ? "tsx"
      : ext === ".ts"
        ? "ts"
        : ext === ".jsx"
          ? "jsx"
          : ext === ".mjs" || ext === ".cjs"
            ? "js"
            : "js";
  const r = esbuild.transformSync(src, {
    loader,
    legalComments: "none",
    minify: false,
    treeShaking: false,
  });
  return r.code;
}

function processFile({ full, rel }) {
  const ext = path.extname(full).toLowerCase();
  let raw = fs.readFileSync(full, "utf8");
  raw = redact(raw, { isEnvStyle: false });

  if (ext === ".json") {
    try {
      const o = JSON.parse(raw);
      const str = JSON.stringify(o, null, 2);
      return redact(str, { isEnvStyle: false });
    } catch {
      return raw;
    }
  }
  if (ext === ".ps1") {
    return redact(stripPs1Comments(raw), { isEnvStyle: false });
  }
  if (ext === ".bat") {
    return redact(stripBatComments(raw), { isEnvStyle: false });
  }

  try {
    const stripped = stripCommentsEsbuild(raw, ext);
    return redact(stripped, { isEnvStyle: false });
  } catch {
    const fallback = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    return redact(fallback, { isEnvStyle: false });
  }
}

function buildTextDocument(sections) {
  const lines = [];
  lines.push("SOURCE CODE DEPOSIT (plain text)");
  lines.push(
    "Work: Point-of-sale (POS) application (web, backend, mobile)"
  );
  lines.push(`Total source files: ${sections.length}`);
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    "Comments removed. Secrets/credentials replaced with [REDACTED]. Paths below are relative to pos/."
  );
  lines.push("");
  lines.push(SEP);
  lines.push("");

  for (const { rel, body } of sections) {
    lines.push(`FILE: pos/${rel}`);
    lines.push(SEP);
    lines.push(body || "(empty)");
    lines.push("");
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(POS_ROOT)) {
    console.error("Missing pos directory:", POS_ROOT);
    process.exit(1);
  }

  const files = collectFiles(POS_ROOT).sort((a, b) =>
    a.rel.localeCompare(b.rel)
  );
  const sections = files.map((f) => ({
    rel: f.rel,
    body: processFile(f),
  }));

  const text = buildTextDocument(sections);
  fs.writeFileSync(OUT_TXT, text, { encoding: "utf8" });
  console.log("Wrote", OUT_TXT, "(" + sections.length + " files)");
}

main();
