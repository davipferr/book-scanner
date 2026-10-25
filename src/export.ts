/** What gets exported for one page. */
export interface ExportPage {
  text?: string | null;
  note?: string;
  highlights?: { quote: string; note: string }[];
}

export type TextFormat = 'txt' | 'md';

export interface TextExportOptions {
  title: string;
  format: TextFormat;
  /** Mark where each page starts, so the text can be matched to the printed book. */
  pageNumbers: boolean;
  /** Number of the first exported page in the book (1-based). */
  firstPage: number;
  /** Add the page's note and highlights after its text. */
  annotations?: boolean;
}

/** The book's text as one plain-text or Markdown document. */
export function bookText(pages: readonly ExportPage[], o: TextExportOptions): string {
  const parts: string[] = [];
  if (o.format === 'md') parts.push(`# ${o.title}`);
  else parts.push(o.title, '='.repeat(Math.min(o.title.length, 60)));

  pages.forEach((page, i) => {
    const n = o.firstPage + i;
    const text = page.text?.trim();
    if (o.pageNumbers) parts.push(o.format === 'md' ? `## Page ${n}` : `--- Page ${n} ---`);
    if (text) parts.push(text);
    else if (o.pageNumbers) parts.push(o.format === 'md' ? '_No text read for this page._' : '[No text read for this page.]');
    if (o.annotations) parts.push(...annotations(page, o.format));
  });
  return parts.join('\n\n') + '\n';
}

/** A safe, readable file name from a book title. */
export function fileName(title: string, extension: string): string {
  const base = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'book'}.${extension}`;
}

function annotations(page: ExportPage, format: TextFormat): string[] {
  const out: string[] = [];
  const note = page.note?.trim();
  if (note) {
    out.push(
      format === 'md'
        ? note
            .split('\n')
            .map((line, i) => `> ${i === 0 ? '**Note:** ' : ''}${line}`)
            .join('\n')
        : `Note: ${note}`,
    );
  }
  const highlights = page.highlights ?? [];
  if (highlights.length) {
    const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
    const lines = highlights.map((h) => {
      const quote = `“${flat(h.quote)}”`;
      const comment = h.note.trim() ? ` — ${flat(h.note)}` : '';
      return format === 'md' ? `- ${quote}${comment}` : `* ${quote}${comment}`;
    });
    out.push(`${format === 'md' ? '**Highlights**' : 'Highlights:'}\n${lines.join('\n')}`);
  }
  return out;
}
