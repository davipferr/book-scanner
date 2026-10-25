import { describe, expect, it } from 'vitest';
import { findAll, fold, snippet } from './search';

describe('fold', () => {
  it('drops accents and case and collapses whitespace', () => {
    expect(fold('Não  É\n\nFÁCIL').text).toBe('nao e facil');
  });

  it('maps folded characters back to the original', () => {
    const f = fold('Ação x');
    expect(f.map).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('findAll', () => {
  const text = 'Não fossem inteiramente maus.\n\nNÃO, disse ele; nao.';

  it('ignores accents and case, returning original ranges', () => {
    const hits = findAll(text, 'nao');
    expect(hits.map((r) => text.slice(r.start, r.end))).toEqual(['Não', 'NÃO', 'nao']);
  });

  it('matches across line breaks', () => {
    const [hit] = findAll(text, 'maus. não');
    expect(text.slice(hit.start, hit.end)).toBe('maus.\n\nNÃO');
  });

  it('returns nothing for an empty query', () => {
    expect(findAll(text, '   ')).toEqual([]);
  });

  it('handles characters outside the basic plane', () => {
    const t = 'a 𝔸 b';
    const [hit] = findAll(t, '𝔸 b');
    expect(t.slice(hit.start, hit.end)).toBe('𝔸 b');
  });
});

describe('snippet', () => {
  it('trims to whole words with ellipses', () => {
    const text = 'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz';
    const s = snippet(text, { start: 41, end: 48 }, 20);
    expect(s).toEqual({ before: '…da cidade para o ', match: 'Engenho', after: ' Novo, encontrei no…' });
  });

  it('keeps short texts whole', () => {
    expect(snippet('abc def', { start: 4, end: 7 })).toEqual({ before: 'abc ', match: 'def', after: '' });
  });
});
