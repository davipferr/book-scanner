/** Text search that ignores case, accents and line breaks, so "nao" finds "Não". */

export interface Folded {
  /** Lowercased, accent-free text with each whitespace run collapsed to one space. */
  text: string;
  /** For each folded character, the index of the original character it came from. */
  map: number[];
}

export function fold(s: string): Folded {
  let text = '';
  const map: number[] = [];
  let lastSpace = false;
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    if (/\s/u.test(ch)) {
      if (!lastSpace) {
        text += ' ';
        map.push(i);
      }
      lastSpace = true;
    } else {
      const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      for (let k = 0; k < f.length; k++) map.push(i);
      text += f;
      lastSpace = false;
    }
    i += ch.length;
  }
  return { text, map };
}

export interface Range {
  start: number;
  end: number;
}

/** Every match of `query` in `text`, as ranges of the original text. */
export function findAll(text: string, query: string): Range[] {
  const q = fold(query).text.trim();
  if (!q) return [];
  const f = fold(text);
  const out: Range[] = [];
  for (let at = f.text.indexOf(q); at >= 0; at = f.text.indexOf(q, at + q.length)) {
    const last = f.map[at + q.length - 1];
    out.push({ start: f.map[at], end: last + String.fromCodePoint(text.codePointAt(last)!).length });
  }
  return out;
}

export interface Snippet {
  before: string;
  match: string;
  after: string;
}

/** The match with some context around it, trimmed to whole words, on one line. */
export function snippet(text: string, r: Range, radius = 60): Snippet {
  let from = Math.max(0, r.start - radius);
  let to = Math.min(text.length, r.end + radius);
  // Don't start or end mid-word.
  if (from > 0) {
    const space = text.indexOf(' ', from);
    if (space >= 0 && space < r.start) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > r.end) to = space;
  }
  const flat = (s: string) => s.replace(/\s+/g, ' ');
  return {
    before: (from > 0 ? '…' : '') + flat(text.slice(from, r.start)),
    match: flat(text.slice(r.start, r.end)),
    after: flat(text.slice(r.end, to)) + (to < text.length ? '…' : ''),
  };
}
