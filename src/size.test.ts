import { describe, expect, it } from 'vitest';
import { fitWithin } from './size';

describe('fitWithin', () => {
  it('keeps sizes that already fit', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1000)).toEqual({ width: 800, height: 600 });
  });

  it('scales landscape and portrait by the longest side', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin({ width: 3000, height: 4000 }, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it('never returns a zero dimension', () => {
    expect(fitWithin({ width: 10000, height: 1 }, 100)).toEqual({ width: 100, height: 1 });
  });

  it('handles an empty size', () => {
    expect(fitWithin({ width: 0, height: 0 }, 100)).toEqual({ width: 0, height: 0 });
  });
});
