import { describe, expect, it } from 'vitest';
import { CLOTHS, bookCloth } from './cloth';

describe('bookCloth', () => {
  it('always gives the same cloth for the same book', () => {
    expect(bookCloth(7)).toBe(bookCloth(7));
  });

  it('picks from a fixed palette of five or six cloths', () => {
    expect(CLOTHS.length).toBeGreaterThanOrEqual(5);
    expect(CLOTHS.length).toBeLessThanOrEqual(6);
    for (let id = 1; id < 50; id++) expect(CLOTHS).toContain(bookCloth(id));
  });

  it('uses every cloth across consecutive ids', () => {
    const seen = new Set(Array.from({ length: CLOTHS.length }, (_, i) => bookCloth(i + 1)));
    expect(seen.size).toBe(CLOTHS.length);
  });

  it('copes with odd ids', () => {
    for (const id of [0, -3, 2 ** 31, Number.MAX_SAFE_INTEGER]) expect(CLOTHS).toContain(bookCloth(id));
  });
});
