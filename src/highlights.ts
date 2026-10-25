import type { Range } from './search';

/**
 * Finds where a highlight sits in the page text now. Offsets can drift when the text is
 * corrected or read again, so if the stored range no longer holds the quote, use the
 * occurrence of the quote closest to where it was. Null when the quote is gone.
 */
export function anchorHighlight(text: string, h: { start: number; end: number; quote: string }): Range | null {
  if (text.slice(h.start, h.end) === h.quote) return { start: h.start, end: h.end };
  if (!h.quote) return null;
  let best: number | null = null;
  for (let at = text.indexOf(h.quote); at >= 0; at = text.indexOf(h.quote, at + 1)) {
    if (best === null || Math.abs(at - h.start) < Math.abs(best - h.start)) best = at;
  }
  return best === null ? null : { start: best, end: best + h.quote.length };
}

export interface Segment {
  start: number;
  end: number;
  /** Ids of the highlights covering this piece, in the order given. */
  ids: number[];
}

/**
 * Splits [0, length) into consecutive pieces where the set of covering highlights is
 * constant, so overlapping highlights can be drawn as plain, non-nested marks.
 */
export function segments(length: number, ranges: readonly (Range & { id: number })[]): Segment[] {
  const cuts = new Set([0, length]);
  for (const r of ranges) {
    cuts.add(Math.min(Math.max(r.start, 0), length));
    cuts.add(Math.min(Math.max(r.end, 0), length));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;
    out.push({ start, end, ids: ranges.filter((r) => r.start <= start && r.end >= end).map((r) => r.id) });
  }
  return out;
}
