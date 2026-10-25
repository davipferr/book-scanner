import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import manifestSource from '../public/manifest.webmanifest?raw';
import fonts from './fonts.css?raw';
import main from './main.ts?raw';
import css from './style.css?raw';

describe('markup', () => {
  it('keeps every element id that main.ts looks up', () => {
    const used = [...main.matchAll(/\$(?:<[^>]+>)?\('([\w-]+)'\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(40);
    const ids = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));
    expect(used.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('matches the PWA colors to the theme background', () => {
    const bg = /--bg:\s*([^;]+);/.exec(css)?.[1].trim();
    const manifest = JSON.parse(manifestSource);
    const meta = /<meta name="theme-color" content="([^"]+)"/.exec(html)?.[1];
    expect(bg).toBeTruthy();
    expect([meta, manifest.theme_color, manifest.background_color]).toEqual([bg, bg, bg]);
  });
});

describe('fonts', () => {
  it('loads no stylesheet or font from another site', () => {
    expect(html).not.toMatch(/<link[^>]+href="https?:/);
    for (const source of [css, fonts]) {
      expect(source).not.toMatch(/url\(\s*['"]?https?:/);
      expect(source).not.toMatch(/@import\s+(url\()?\s*['"]?https?:/);
    }
  });

  it('ships only the latin subsets of Literata and Alegreya Sans', () => {
    const urls = [...fonts.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => !/-latin-(ext-)?/.test(u))).toEqual([]);
    expect(fonts).toMatch(/font-family:\s*'Literata'/);
    expect(fonts).toMatch(/font-family:\s*'Alegreya Sans'/);
  });
});
