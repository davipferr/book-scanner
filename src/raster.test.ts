import { describe, expect, it } from 'vitest';
import {
  createRaster,
  detectPage,
  documentFilter,
  grayFilter,
  luminance,
  otsuThreshold,
  warpPerspective,
  type Raster,
} from './raster';

function fill(img: Raster, fn: (x: number, y: number) => number): Raster {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = fn(x, y);
      img.data[i + 3] = 255;
    }
  }
  return img;
}

const at = (img: Raster, x: number, y: number) => img.data[(y * img.width + x) * 4];

describe('warpPerspective', () => {
  it('copies an axis-aligned crop exactly', () => {
    const src = fill(createRaster(40, 30), (x, y) => (x * 5 + y) % 256);
    const out = warpPerspective(
      src,
      [
        { x: 10, y: 5 },
        { x: 30, y: 5 },
        { x: 30, y: 25 },
        { x: 10, y: 25 },
      ],
      20,
      20,
    );
    expect(at(out, 0, 0)).toBe(at(src, 10, 5));
    expect(at(out, 19, 19)).toBe(at(src, 29, 24));
    expect(out.data[3]).toBe(255);
  });

  it('turns a tilted bright quad into a fully bright rectangle', () => {
    const quad = [
      { x: 20, y: 10 },
      { x: 80, y: 20 },
      { x: 75, y: 90 },
      { x: 10, y: 80 },
    ] as const;
    // Bright inside the quad (half-plane test against each edge), dark outside.
    const inside = (x: number, y: number) =>
      quad.every((a, i) => {
        const b = quad[(i + 1) % 4];
        return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0;
      });
    const src = fill(createRaster(100, 100), (x, y) => (inside(x + 0.5, y + 0.5) ? 250 : 10));
    const out = warpPerspective(src, [...quad], 50, 60);
    // Interior samples are all bright; only the outermost ring may blend with the border.
    let dark = 0;
    for (let y = 2; y < 58; y++) for (let x = 2; x < 48; x++) if (at(out, x, y) < 200) dark++;
    expect(dark).toBe(0);
  });
});

describe('grayFilter', () => {
  it('stretches a low-contrast image to full range', () => {
    const img = fill(createRaster(100, 10), (x) => 100 + x / 2);
    grayFilter(img);
    expect(at(img, 0, 0)).toBe(0);
    expect(at(img, 99, 0)).toBe(255);
  });
});

describe('documentFilter', () => {
  it('whitens shaded paper and keeps ink dark', () => {
    // Paper fades from 230 to 110 left-to-right (a shadow); a vertical ink stroke in each half.
    const img = fill(createRaster(400, 300), (x) => {
      const paper = 230 - (x / 400) * 120;
      const ink = (x >= 60 && x < 64) || (x >= 330 && x < 334);
      return ink ? paper * 0.25 : paper;
    });
    documentFilter(img);
    expect(at(img, 20, 150)).toBeGreaterThan(240);
    expect(at(img, 370, 150)).toBeGreaterThan(240);
    expect(at(img, 61, 150)).toBeLessThan(20);
    expect(at(img, 331, 150)).toBeLessThan(20);
  });
});

describe('otsuThreshold', () => {
  it('splits a two-level image between the levels', () => {
    const img = fill(createRaster(10, 10), (x) => (x < 5 ? 40 : 200));
    const t = otsuThreshold(luminance(img));
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
  });
});

describe('detectPage', () => {
  it('finds the corners of a bright page on a dark table', () => {
    const img = fill(createRaster(200, 200), (x, y) => (x >= 40 && x < 160 && y >= 20 && y < 180 ? 235 : 40));
    const q = detectPage(img)!;
    expect(q).not.toBeNull();
    expect(q[0].x).toBeCloseTo(0.2, 2);
    expect(q[0].y).toBeCloseTo(0.1, 2);
    expect(q[2].x).toBeCloseTo(0.8, 2);
    expect(q[2].y).toBeCloseTo(0.9, 2);
  });

  it('gives up when the whole frame is paper', () => {
    expect(detectPage(fill(createRaster(50, 50), () => 230))).toBeNull();
  });
});
