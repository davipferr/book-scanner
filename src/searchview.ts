import type { Book, Highlight, Page } from './page';
import { findAll, snippet, type Range, type Snippet } from './search';

export interface SearchHit {
  book: Book;
  page: Page;
  /** 1-based position of the page in its book. */
  pageNumber: number;
  where: 'text' | 'page note' | 'highlight note';
  snippet: Snippet;
  /** Match position in the page text, for jumping to it. */
  range?: Range;
}

/** Hits beyond this are not shown; the count still says how many there were. */
export const MAX_HITS = 200;

/** Searches the text, page notes and highlight notes of the given books. */
export function searchBooks(
  books: Book[],
  pagesById: Map<number, Page>,
  highlights: Highlight[],
  query: string,
): { hits: SearchHit[]; total: number } {
  const hits: SearchHit[] = [];
  let total = 0;
  const add = (hit: SearchHit) => {
    total++;
    if (hits.length < MAX_HITS) hits.push(hit);
  };
  for (const book of books) {
    book.pageIds.forEach((id, i) => {
      const page = pagesById.get(id);
      if (!page) return;
      const base = { book, page, pageNumber: i + 1 };
      for (const r of findAll(page.text ?? '', query)) {
        add({ ...base, where: 'text', snippet: snippet(page.text!, r), range: r });
      }
      for (const r of findAll(page.note ?? '', query)) add({ ...base, where: 'page note', snippet: snippet(page.note!, r) });
      for (const h of highlights) {
        if (h.pageId !== id) continue;
        for (const r of findAll(h.note, query)) add({ ...base, where: 'highlight note', snippet: snippet(h.note, r) });
      }
    });
  }
  return { hits, total };
}

/** Renders hits as a tappable list; `showBook` adds the book title to each one. */
export function renderHits(
  container: HTMLElement,
  result: { hits: SearchHit[]; total: number },
  showBook: boolean,
  onPick: (hit: SearchHit) => void,
): void {
  const summary = document.createElement('p');
  summary.className = 'search-summary';
  summary.textContent =
    result.total === 0
      ? 'No matches.'
      : `${result.total} ${result.total === 1 ? 'match' : 'matches'}` +
        (result.total > result.hits.length ? `, showing the first ${result.hits.length}` : '');

  const list = document.createElement('ul');
  list.className = 'search-hits';
  for (const hit of result.hits) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-hit';
    const where = document.createElement('span');
    where.className = 'search-where';
    where.textContent =
      (showBook ? `${hit.book.title} · ` : '') + `Page ${hit.pageNumber}` + (hit.where === 'text' ? '' : ` · ${hit.where}`);
    const text = document.createElement('span');
    text.className = 'search-snippet';
    const mark = document.createElement('mark');
    mark.textContent = hit.snippet.match;
    text.append(hit.snippet.before, mark, hit.snippet.after);
    button.append(where, text);
    button.addEventListener('click', () => onPick(hit));
    const li = document.createElement('li');
    li.append(button);
    list.append(li);
  }
  container.replaceChildren(summary, list);
}
