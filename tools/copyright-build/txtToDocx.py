"""Convert Source_code.txt to Source_code.docx (monospace, chunked for large files)."""
from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.shared import Inches, Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def set_run_font(run, name: str, size_pt: float) -> None:
    run.font.name = name
    run.font.size = Pt(size_pt)
    r = run._element
    rpr = r.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)


def main() -> None:
    workspace = Path(__file__).resolve().parents[2]
    src = workspace / "Source_code.txt"
    out = workspace / "Source_code.docx"
    if not src.is_file():
        print("Missing:", src, file=sys.stderr)
        sys.exit(1)

    text = src.read_text(encoding="utf-8")
    lines = text.splitlines()
    chunk_lines = 400

    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = Inches(0.6)
    sec.right_margin = Inches(0.6)
    sec.top_margin = Inches(0.6)
    sec.bottom_margin = Inches(0.6)

    font_name = "Courier New"
    font_pt = 8.0

    for i in range(0, len(lines), chunk_lines):
        chunk = "\n".join(lines[i : i + chunk_lines])
        p = doc.add_paragraph(chunk)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        for run in p.runs:
            set_run_font(run, font_name, font_pt)

    doc.save(out)
    print("Wrote", out)


if __name__ == "__main__":
    main()
