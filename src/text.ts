/**
 * Turns OCR output (one hard line break per printed line) into readable paragraphs: lines in a
 * paragraph are joined, words split across lines with a hyphen are rejoined, and blank lines
 * stay as paragraph breaks.
 */
export function reflowText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((para) => {
      const lines = para
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      let out = '';
      for (const line of lines) {
        if (!out) out = line;
        // "pala-" + "vra" → "palavra"; only when the next line starts lowercase, so real
        // dashes ("— Disse ele") and compound names at line ends survive.
        else if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
        else out += ' ' + line;
      }
      return out;
    })
    .filter(Boolean)
    .join('\n\n');
}
