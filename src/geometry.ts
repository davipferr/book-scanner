export interface Point {
  x: number;
  y: number;
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** 3x3 projective matrix, row-major, with the last entry fixed to 1. */
export type Homography = number[];

export type Rotation = 0 | 90 | 180 | 270;

export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Solves for the homography that maps each `src` corner onto the matching `dst` corner. */
export function homography(src: Quad, dst: Quad): Homography {
  // Each pair gives two rows of the 8x8 system A·h = b (h8 = 1).
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting on the augmented matrix.
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('Degenerate quad: corners are collinear.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      if (f === 0) continue;
      for (let c = col; c < 9; c++) a[r][c] -= f * a[col][c];
    }
  }
  const h = a.map((row, i) => row[8] / row[i]);
  h.push(1);
  return h;
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output rectangle for a flattened quad: the longer of each pair of opposite edges. */
export function quadOutputSize(q: Quad): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(Math.max(dist(q[0], q[1]), dist(q[3], q[2])))),
    height: Math.max(1, Math.round(Math.max(dist(q[0], q[3]), dist(q[1], q[2])))),
  };
}

/** True when the corners form a convex quad in clockwise (screen) order, which a page must be. */
export function isConvexQuad(q: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= 0) return false;
  }
  return true;
}

export function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  return q.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad;
}

/**
 * Re-expresses normalized corners after the image is turned 90° clockwise (`turns` times),
 * keeping them in top-left, top-right, bottom-right, bottom-left order.
 */
export function rotateQuadCW(q: Quad, turns = 1): Quad {
  let out = q;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const r = out.map((p) => ({ x: 1 - p.y, y: p.x }));
    // The old bottom-left becomes the new top-left.
    out = [r[3], r[0], r[1], r[2]];
  }
  return out;
}

export function addRotation(r: Rotation, delta: number): Rotation {
  return ((((r + delta) % 360) + 360) % 360) as Rotation;
}

/** Moves each corner `amount` of the way toward the quad's center. */
export function insetQuad(q: Quad, amount: number): Quad {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  return q.map((p) => ({ x: p.x + (cx - p.x) * amount, y: p.y + (cy - p.y) * amount })) as Quad;
}
