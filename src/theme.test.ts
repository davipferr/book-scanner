import { describe, expect, it } from 'vitest';
import source from './style.css?raw';
import { CLOTHS } from './cloth';

const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const rest = css.replace(/:root\s*\{[^}]*\}/, '');

/** Custom properties declared on :root. */
const tokens = new Map([...rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

function token(name: string): string {
  const v = tokens.get(name);
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

/** All declarations of every rule whose selector list includes `selector`. */
function rule(selector: string): string {
  return [...rest.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim() === selector))
    .map((m) => m[2].replace(/var\((--[\w-]+)\)/g, (v, name: string) => tokens.get(name) ?? v))
    .join(';');
}

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((c) => c + c).join('') : n.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme tokens', () => {
  it('keeps body and muted text readable on the background and surfaces (AA)', () => {
    for (const bg of ['--bg', '--surface', '--surface-2']) {
      for (const fg of ['--text', '--muted']) {
        expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps gilt titles readable on every cloth', () => {
    for (const cloth of CLOTHS) {
      expect(contrast(token('--gilt'), token(`--cloth-${cloth}`)), cloth).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps primary button text readable', () => {
    expect(contrast(token('--on-gilt'), token('--gilt'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps danger and gilt text readable on the background', () => {
    expect(contrast(token('--danger'), token('--bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--gilt'), token('--surface-2'))).toBeGreaterThanOrEqual(4.5);
  });

  it('declares colors only on :root', () => {
    const values = [...rest.matchAll(/:\s*([^;{}]+)[;}]/g)].map((m) => m[1]);
    const literal = values.filter((v) => /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|\b(white|black)\b/i.test(v));
    expect(literal).toEqual([]);
  });

  it('gives every cloth a token and a selector', () => {
    for (const cloth of CLOTHS) {
      expect(tokens.has(`--cloth-${cloth}`), cloth).toBe(true);
      expect(rest).toContain(`[data-cloth='${cloth}']`);
    }
  });
});

describe('controls', () => {
  it('shows a visible focus ring in the accent color', () => {
    const focus = rule(':focus-visible');
    const width = Number(/outline:\s*(\d+)px/.exec(focus)?.[1] ?? 0);
    expect(width).toBeGreaterThanOrEqual(2);
    expect(focus).toContain(token('--gilt'));
  });

  it('makes touch targets at least 44px tall', () => {
    const targets = [
      '.button',
      '.icon-button',
      '.back-button',
      '.tabs button',
      '.segmented button',
      'select',
      '.search-input',
      '.swatch',
      '.link-button',
      '.reader-page-label',
      '.insert-chip button',
    ];
    for (const sel of targets) {
      const sizes = [...rule(sel).matchAll(/(?:^|;|\s)(?:min-)?height:\s*(\d+)px/g)].map((m) => Number(m[1]));
      expect(Math.max(0, ...sizes), sel).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('covers', () => {
  // Clipped lines show through padding on the clamped element itself (verify, failure 1).
  it('clamps long titles on an element without vertical padding', () => {
    const clamped = [...rest.matchAll(/([^{}]+)\{([^}]*-webkit-line-clamp[^}]*)\}/g)];
    expect(clamped.map((m) => m[1].trim())).toEqual(['.book-stamp-text']);
    expect(clamped[0][2]).not.toMatch(/padding/);
  });
});

describe('reading', () => {
  it('sets page text in Literata at a comfortable measure', () => {
    expect(rule('.reader-text')).toMatch(/Literata/);
    const measure = Number(/max-width:\s*(\d+)ch/.exec(rule('.reader'))?.[1] ?? Infinity);
    expect(measure).toBeLessThanOrEqual(70);
  });

  it('retones the four stored highlight colors', () => {
    for (const color of ['yellow', 'green', 'blue', 'pink']) {
      expect(tokens.has(`--hl-${color}`), color).toBe(true);
      expect(rule(`.hl-${color}`)).toContain(token(`--hl-${color}`));
    }
  });
});

describe('scanner', () => {
  it('keeps the camera surround neutral', () => {
    for (const sel of ['.viewfinder', '.controls']) {
      expect(rule(sel), sel).toMatch(new RegExp(`background:\\s*${token('--void')}`));
    }
    expect(token('--void')).toMatch(/^#0{3}(0{3})?$/);
  });
});
