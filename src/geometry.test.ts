import { describe, expect, it } from 'vitest';
import {
  FULL_QUAD,
  addRotation,
  applyHomography,
  insetQuad,
  homography,
  isConvexQuad,
  quadOutputSize,
  rotateQuadCW,
  type Quad,
} from './geometry';

const skewed: Quad = [
  { x: 120, y: 80 },
  { x: 900, y: 140 },
  { x: 860, y: 1300 },
  { x: 60, y: 1180 },
];

const rect: Quad = [
  { x: 0, y: 0 },
  { x: 800, y: 0 },
  { x: 800, y: 1200 },
  { x: 0, y: 1200 },
];

describe('homography', () => {
  it('maps every source corner onto its destination', () => {
    const h = homography(rect, skewed);
    rect.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(skewed[i].x, 6);
      expect(q.y).toBeCloseTo(skewed[i].y, 6);
    });
  });

  it('is the identity for identical quads', () => {
    const h = homography(skewed, skewed);
    const p = applyHomography(h, { x: 400, y: 600 });
    expect(p.x).toBeCloseTo(400, 6);
    expect(p.y).toBeCloseTo(600, 6);
  });

  it('round-trips through the inverse mapping', () => {
    const forward = homography(rect, skewed);
    const back = homography(skewed, rect);
    const p = applyHomography(back, applyHomography(forward, { x: 321, y: 987 }));
    expect(p.x).toBeCloseTo(321, 6);
    expect(p.y).toBeCloseTo(987, 6);
  });

  it('rejects collinear corners', () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(() => homography(rect, line)).toThrow();
  });
});

describe('quadOutputSize', () => {
  it('uses the longer of each pair of opposite edges', () => {
    expect(quadOutputSize(rect)).toEqual({ width: 800, height: 1200 });
    const trapezoid: Quad = [
      { x: 100, y: 0 },
      { x: 300, y: 0 },
      { x: 400, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(quadOutputSize(trapezoid).width).toBe(400);
  });
});

describe('isConvexQuad', () => {
  it('accepts a clockwise convex quad', () => {
    expect(isConvexQuad(skewed)).toBe(true);
  });

  it('rejects a self-intersecting (bow-tie) quad', () => {
    expect(isConvexQuad([skewed[0], skewed[2], skewed[1], skewed[3]])).toBe(false);
  });

  it('rejects a concave quad', () => {
    expect(isConvexQuad([rect[0], rect[1], { x: 300, y: 200 }, rect[3]])).toBe(false);
  });
});

describe('rotateQuadCW', () => {
  it('keeps the full frame as the full frame', () => {
    expect(rotateQuadCW(FULL_QUAD)).toEqual(FULL_QUAD);
  });

  it('moves a corner region the way the image turns', () => {
    // A small box near the top-left ends up near the top-right after a clockwise turn.
    const box: Quad = [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.3, y: 0.2 },
      { x: 0.1, y: 0.2 },
    ];
    const r = rotateQuadCW(box);
    expect(r[0].x).toBeCloseTo(0.8);
    expect(r[0].y).toBeCloseTo(0.1);
    expect(r[2].x).toBeCloseTo(0.9);
    expect(r[2].y).toBeCloseTo(0.3);
    expect(isConvexQuad(r)).toBe(true);
  });

  it('returns to the start after four turns', () => {
    const r = rotateQuadCW(skewed.map((p) => ({ x: p.x / 1000, y: p.y / 1400 })) as Quad, 4);
    expect(r[1].x).toBeCloseTo(0.9);
    expect(rotateQuadCW(FULL_QUAD, -1)).toEqual(FULL_QUAD);
  });
});

describe('addRotation', () => {
  it('wraps around in both directions', () => {
    expect(addRotation(270, 90)).toBe(0);
    expect(addRotation(0, -90)).toBe(270);
  });
});

describe('insetQuad', () => {
  it('pulls every corner toward the center', () => {
    const q = insetQuad(FULL_QUAD, 0.1);
    expect(q[0]).toEqual({ x: 0.05, y: 0.05 });
    expect(q[2].x).toBeCloseTo(0.95);
    expect(q[2].y).toBeCloseTo(0.95);
  });
});
