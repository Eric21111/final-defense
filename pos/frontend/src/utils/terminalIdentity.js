export const TERMINAL_ID_KEY = 'pos-terminal-id';

/** Same normalization as setTerminalId, without reading/writing storage. */
export function normalizeTerminalId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32);
}

export function getTerminalId() {
  try {
    return String(localStorage.getItem(TERMINAL_ID_KEY) || '')
      .trim();
  } catch {
    return '';
  }
}

export function setTerminalId(value) {
  try {
    const s = normalizeTerminalId(value);
    if (s) {
      localStorage.setItem(TERMINAL_ID_KEY, s);
    } else {
      localStorage.removeItem(TERMINAL_ID_KEY);
    }
    return s;
  } catch {
    return '';
  }
}
