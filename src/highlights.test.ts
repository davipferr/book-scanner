import { describe, expect, it } from 'vitest';
import { anchorHighlight, segments } from './highlights';

describe('anchorHighlight', () => {
  const text = 'o trem da Central; o trem parou.';

  it('keeps a range that still holds the quote', () => {
    expect(anchorHighlight(text, { start: 2, end: 6, quote: 'trem' })).toEqual({ start: 2, end: 6 });
  });

  it('follows the quote to the nearest occurrence after an edit', () => {
    // The second "trem" was at 21 before two characters were inserted earlier in the text.
    expect(anchorHighlight(text, { start: 19, end: 23, quote: 'trem' })).toEqual({ start: 21, end: 25 });
  });

  it('gives up when the quote is gone', () => {
    expect(anchorHighlight(text, { start: 2, end: 9, quote: 'bonde' })).toBeNull();
  });
});

describe('segments', () => {
  it('covers the whole text with plain and highlighted pieces', () => {
    expect(segments(10, [{ id: 1, start: 2, end: 5 }])).toEqual([
      { start: 0, end: 2, ids: [] },
      { start: 2, end: 5, ids: [1] },
      { start: 5, end: 10, ids: [] },
    ]);
  });

  it('splits overlapping highlights', () => {
    expect(
      segments(8, [
        { id: 1, start: 1, end: 5 },
        { id: 2, start: 3, end: 7 },
      ]),
    ).toEqual([
      { start: 0, end: 1, ids: [] },
      { start: 1, end: 3, ids: [1] },
      { start: 3, end: 5, ids: [1, 2] },
      { start: 5, end: 7, ids: [2] },
      { start: 7, end: 8, ids: [] },
    ]);
  });

  it('clamps ranges to the text', () => {
    expect(segments(3, [{ id: 1, start: 1, end: 9 }])).toEqual([
      { start: 0, end: 1, ids: [] },
      { start: 1, end: 3, ids: [1] },
    ]);
  });
});
