import { describe, expect, it } from 'vitest';
import { reflowText } from './text';

describe('reflowText', () => {
  it('joins the lines of a paragraph', () => {
    expect(reflowText('Uma noite destas, vindo da\ncidade para o Engenho Novo,\nencontrei no trem')).toBe(
      'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem',
    );
  });

  it('keeps blank lines as paragraph breaks', () => {
    expect(reflowText('First line\nstill first.\n\nSecond\nparagraph.\n')).toBe(
      'First line still first.\n\nSecond paragraph.',
    );
  });

  it('rejoins hyphenated words, including accented ones', () => {
    expect(reflowText('uma pala-\nvra e a ação-\nzinha')).toBe('uma palavra e a açãozinha');
  });

  it('keeps a hyphen when the next line starts uppercase', () => {
    expect(reflowText('Rio-\nGrande')).toBe('Rio- Grande');
  });

  it('collapses extra spaces, blank runs and Windows line endings', () => {
    expect(reflowText('  a   b \r\n c\r\n\r\n\r\n\r\nd  ')).toBe('a b c\n\nd');
  });

  it('returns an empty string for blank input', () => {
    expect(reflowText(' \n \n')).toBe('');
  });
});
