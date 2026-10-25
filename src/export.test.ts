import { describe, expect, it } from 'vitest';
import { bookText, fileName } from './export';

const pages = [{ text: 'Uma noite destas.' }, { text: null }, { text: '  Agora que expliquei.\n' }];

describe('bookText', () => {
  it('writes Markdown with page headings', () => {
    expect(bookText(pages, { title: 'Dom Casmurro', format: 'md', pageNumbers: true, firstPage: 1 })).toBe(
      '# Dom Casmurro\n\n## Page 1\n\nUma noite destas.\n\n## Page 2\n\n_No text read for this page._\n\n' +
        '## Page 3\n\nAgora que expliquei.\n',
    );
  });

  it('writes plain text without page markers, skipping empty pages', () => {
    expect(bookText(pages, { title: 'Dom Casmurro', format: 'txt', pageNumbers: false, firstPage: 1 })).toBe(
      'Dom Casmurro\n\n============\n\nUma noite destas.\n\nAgora que expliquei.\n',
    );
  });

  it('numbers pages from the start of the exported range', () => {
    const out = bookText([{ text: 'x' }], { title: 'T', format: 'txt', pageNumbers: true, firstPage: 12 });
    expect(out).toContain('--- Page 12 ---');
  });
});

describe('bookText annotations', () => {
  const annotated = [
    {
      text: 'Uma noite destas.',
      note: 'Abertura do livro.\nLembrar do trem.',
      highlights: [
        { quote: 'noite\ndestas', note: 'quando?' },
        { quote: 'Uma', note: '' },
      ],
    },
  ];

  it('adds notes and highlights in Markdown', () => {
    expect(bookText(annotated, { title: 'T', format: 'md', pageNumbers: true, firstPage: 1, annotations: true })).toBe(
      '# T\n\n## Page 1\n\nUma noite destas.\n\n> **Note:** Abertura do livro.\n> Lembrar do trem.\n\n' +
        '**Highlights**\n- “noite destas” — quando?\n- “Uma”\n',
    );
  });

  it('adds them in plain text, and leaves them out when not asked', () => {
    const txt = bookText(annotated, { title: 'T', format: 'txt', pageNumbers: false, firstPage: 1, annotations: true });
    expect(txt).toContain('Note: Abertura do livro.\nLembrar do trem.');
    expect(txt).toContain('Highlights:\n* “noite destas” — quando?\n* “Uma”');
    expect(bookText(annotated, { title: 'T', format: 'txt', pageNumbers: false, firstPage: 1 })).not.toContain('Note');
  });
});

describe('fileName', () => {
  it('strips accents and punctuation', () => {
    expect(fileName('Memórias Póstumas de Brás Cubas!', 'pdf')).toBe('memorias-postumas-de-bras-cubas.pdf');
  });

  it('falls back when nothing is left', () => {
    expect(fileName('???', 'md')).toBe('book.md');
  });
});
