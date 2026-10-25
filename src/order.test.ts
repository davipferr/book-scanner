import { describe, expect, it } from 'vitest';
import { insertAt, moveItem } from './order';

describe('moveItem', () => {
  it('moves forward and backward', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });

  it('clamps the target and ignores a bad source', () => {
    expect(moveItem([1, 2, 3], 0, 99)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, -5)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 7, 0)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input', () => {
    const list = [1, 2, 3];
    moveItem(list, 0, 2);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe('insertAt', () => {
  it('inserts in the middle, at the start and past the end', () => {
    expect(insertAt([1, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(insertAt([1, 2], 0, -1)).toEqual([0, 1, 2]);
    expect(insertAt([1, 2], 3, 10)).toEqual([1, 2, 3]);
  });
});
