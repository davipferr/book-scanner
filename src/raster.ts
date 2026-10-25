import { applyHomography, homography, type Quad } from './geometry';

/** Same shape as the DOM ImageData, so these functions also run in tests and workers. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type PageFilter = 'original' | 'gray' | 'document';

export function createRaster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/**
 * Flattens the region inside `quad` (pixel coordinates of `src`) into a `width`×`height`
 * rectangle, sampling with bilinear interpolation.
 */
export function warpPerspective(src: Raster, quad: Quad, width: number, height: number): Raster {
  const out = createRaster(width, height);
  // Map output pixel centers back to source positions.
  const h = homography(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    quad,
  );
  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  const d = out.data;
  let o = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++, o += 4) {
      const p = applyHomography(h, { x: x + 0.5, y: y + 0.5 });
      // Pixel centers are at +0.5; clamp so edges repeat instead of going black.
      const fx = Math.min(Math.max(p.x - 0.5, 0), sw - 1);
      const fy = Math.min(Math.max(p.y - 0.5, 0), sh - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const top = s[i00 + c] + (s[i10 + c] - s[i00 + c]) * tx;
        const bottom = s[i01 + c] + (s[i11 + c] - s[i01 + c]) * tx;
        d[o + c] = top + (bottom - top) * ty;
      }
      d[o + 3] = 255;
    }
  }
  return out;
}

/** Rec. 601 luma of each pixel. */
export function luminance(img: Raster): Uint8ClampedArray {
  const n = img.width * img.height;
  const out = new Uint8ClampedArray(n);
  const d = img.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  return out;
}

function writeGray(img: Raster, gray: ArrayLike<number>): void {
  const d = img.data;
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    d[j] = d[j + 1] = d[j + 2] = gray[i];
    d[j + 3] = 255;
  }
}

/** Value below which `fraction` of the samples fall. */
function percentile(values: Uint8ClampedArray, fraction: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) hist[values[i]]++;
  const target = fraction * values.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) {
    sum += hist[v];
    if (sum >= target) return v;
  }
  return 255;
}

/** Grayscale, with levels stretched so the darkest 1% is black and the brightest 1% is white. */
export function grayFilter(img: Raster): void {
  const gray = luminance(img);
  const lo = percentile(gray, 0.01);
  const hi = Math.max(lo + 1, percentile(gray, 0.99));
  const scale = 255 / (hi - lo);
  for (let i = 0; i < gray.length; i++) gray[i] = (gray[i] - lo) * scale;
  writeGray(img, gray);
}

/**
 * "Scanned document" look: divides out uneven lighting (shadows, the curve near the spine)
 * so the paper turns white and the ink turns black.
 */
export function documentFilter(img: Raster): void {
  const { width: w, height: h } = img;
  const gray = luminance(img);
  const bg = estimateBackground(gray, w, h);
  const out = new Uint8ClampedArray(gray.length);
  // Ratio to paper brightness: 1 on clean paper, low on ink. Map [INK, PAPER] to [0, 255].
  const INK = 0.45;
  const PAPER = 0.88;
  for (let i = 0; i < gray.length; i++) {
    const ratio = gray[i] / Math.max(bg[i], 1);
    const t = Math.min(Math.max((ratio - INK) / (PAPER - INK), 0), 1);
    // Smoothstep keeps letter edges anti-aliased instead of jagged.
    out[i] = 255 * t * t * (3 - 2 * t);
  }
  writeGray(img, out);
}

/**
 * Paper brightness at each pixel: the max of coarse blocks (thin text disappears), smoothed
 * and bilinearly upsampled to full size.
 */
export function estimateBackground(gray: Uint8ClampedArray, w: number, h: number): Float32Array {
  const block = Math.max(8, Math.round(Math.min(w, h) / 40));
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(h / block);
  const blocks = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      // A high percentile rather than the max, so a single bright speck doesn't win.
      const hist = new Uint16Array(256);
      let n = 0;
      for (let y = by * block; y < Math.min(h, (by + 1) * block); y++) {
        for (let x = bx * block; x < Math.min(w, (bx + 1) * block); x++) {
          hist[gray[y * w + x]]++;
          n++;
        }
      }
      let acc = 0;
      let v = 255;
      for (; v > 0; v--) {
        acc += hist[v];
        if (acc >= n * 0.05) break;
      }
      blocks[by * bw + bx] = v;
    }
  }
  // Blocks that are entirely ink (a big dark figure) would read as dark paper; take the max with
  // neighbours, then smooth with a 3x3 mean.
  const dilated = new Float32Array(blocks.length);
  const smooth = new Float32Array(blocks.length);
  for (const [from, to, op] of [
    [blocks, dilated, 'max'],
    [dilated, smooth, 'mean'],
  ] as const) {
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let acc = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = bx + dx;
            const y = by + dy;
            if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
            const v = from[y * bw + x];
            acc = op === 'max' ? Math.max(acc, v) : acc + v;
            n++;
          }
        }
        to[by * bw + bx] = op === 'max' ? acc : acc / n;
      }
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max((y + 0.5) / block - 0.5, 0), bh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, bh - 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max((x + 0.5) / block - 0.5, 0), bw - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, bw - 1);
      const tx = fx - x0;
      const top = smooth[y0 * bw + x0] + (smooth[y0 * bw + x1] - smooth[y0 * bw + x0]) * tx;
      const bottom = smooth[y1 * bw + x0] + (smooth[y1 * bw + x1] - smooth[y1 * bw + x0]) * tx;
      out[y * w + x] = top + (bottom - top) * ty;
    }
  }
  return out;
}

export function applyFilter(img: Raster, filter: PageFilter): void {
  if (filter === 'gray') grayFilter(img);
  else if (filter === 'document') documentFilter(img);
}

/** Otsu's threshold: the gray level that best splits the histogram into two classes. */
export function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

/**
 * Finds a bright page on a darker background: the largest bright region, with its corners
 * taken as the extreme points along the two diagonals. Returns normalized corners, or null
 * when nothing page-like stands out.
 */
export function detectPage(img: Raster): Quad | null {
  const { width: w, height: h } = img;
  const gray = luminance(img);
  const t = otsuThreshold(gray);
  const bright = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) bright[i] = gray[i] > t ? 1 : 0;

  // Largest 4-connected bright component.
  const label = new Int32Array(gray.length);
  const stack = new Int32Array(gray.length);
  let bestLabel = 0;
  let bestSize = 0;
  let next = 1;
  for (let start = 0; start < gray.length; start++) {
    if (!bright[start] || label[start]) continue;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    let size = 0;
    while (top > 0) {
      const i = stack[--top];
      size++;
      const x = i % w;
      const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of neighbours) {
        if (j < 0 || j >= gray.length || !bright[j] || label[j]) continue;
        label[j] = next;
        stack[top++] = j;
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
    next++;
  }
  const area = bestSize / gray.length;
  if (area < 0.15 || area > 0.97) return null;

  let tl = { s: Infinity, x: 0, y: 0 };
  let br = { s: -Infinity, x: 0, y: 0 };
  let tr = { s: -Infinity, x: 0, y: 0 };
  let bl = { s: Infinity, x: 0, y: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] !== bestLabel) continue;
      const sum = x + y;
      const diff = x - y;
      if (sum < tl.s) tl = { s: sum, x, y };
      if (sum > br.s) br = { s: sum, x, y };
      if (diff > tr.s) tr = { s: diff, x, y };
      if (diff < bl.s) bl = { s: diff, x, y };
    }
  }
  // Use pixel edges so a full-width page reaches 0 and 1.
  return [
    { x: tl.x / w, y: tl.y / h },
    { x: (tr.x + 1) / w, y: tr.y / h },
    { x: (br.x + 1) / w, y: (br.y + 1) / h },
    { x: bl.x / w, y: (bl.y + 1) / h },
  ];
}
