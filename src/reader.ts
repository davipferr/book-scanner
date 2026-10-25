import { anchorHighlight, segments } from './highlights';
import { NoteDialog } from './notedialog';
import { HIGHLIGHT_COLORS, type Highlight, type HighlightColor, type Page } from './page';
import type { Range } from './search';

export interface ReaderActions {
  addHighlight(page: Page, range: Range, quote: string, color: HighlightColor): Promise<void>;
  updateHighlight(h: Highlight): Promise<void>;
  deleteHighlight(h: Highlight): Promise<void>;
  savePageNote(page: Page, note: string): Promise<void>;
  /** Shows the page image. */
  openPage(page: Page): void;
}

/** A highlight placed in the current text of its page (null range when the quote is gone). */
interface Placed {
  h: Highlight;
  range: Range | null;
}

/** How long a search match stays marked after jumping to it. */
const FLASH_MS = 2500;

/**
 * The book's text as one continuous read, where selecting text creates a highlight, plus
 * the list of all highlights and notes.
 */
export class Reader {
  private pages: Page[] = [];
  private placed = new Map<number, Placed[]>();
  private pending: { page: Page; range: Range; quote: string } | null = null;
  private barPressed = false;
  private flashTimer: number | undefined;

  constructor(
    private readonly readEl: HTMLElement,
    private readonly notesEl: HTMLElement,
    private readonly selectionBar: HTMLElement,
    private readonly notes: NoteDialog,
    private readonly actions: ReaderActions,
  ) {
    selectionBar.replaceChildren(
      Object.assign(document.createElement('span'), { textContent: 'Highlight' }),
      ...HIGHLIGHT_COLORS.map((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `swatch hl-${c}`;
        b.setAttribute('aria-label', `Highlight in ${c}`);
        b.addEventListener('click', () => void this.highlightSelection(c));
        return b;
      }),
    );
    // Keep the text selection alive while tapping a color.
    selectionBar.addEventListener('pointerdown', (e) => {
      this.barPressed = true;
      e.preventDefault();
    });
    // A press that didn't end on a color (no click) must not keep the bar stuck open.
    const release = () => window.setTimeout(() => (this.barPressed = false), 400);
    selectionBar.addEventListener('pointerup', release);
    selectionBar.addEventListener('pointercancel', release);
    document.addEventListener('selectionchange', () => this.onSelectionChange());

    readEl.addEventListener('click', (e) => {
      const target = e.target as Element;
      const mark = target.closest<HTMLElement>('mark[data-ids]');
      if (mark && window.getSelection()?.isCollapsed !== false) {
        const ids = mark.dataset.ids!.split(',').map(Number);
        const h = this.findHighlight(ids[ids.length - 1]);
        if (h) void this.editHighlight(h);
        return;
      }
      const pageButton = target.closest<HTMLElement>('[data-open-page]');
      if (pageButton) {
        const page = this.pages.find((p) => p.id === Number(pageButton.dataset.openPage));
        if (page) this.actions.openPage(page);
        return;
      }
      const noteButton = target.closest<HTMLElement>('[data-edit-note]');
      if (noteButton) {
        const page = this.pages.find((p) => p.id === Number(noteButton.dataset.editNote));
        if (page) void this.editPageNote(page);
      }
    });
  }

  /** Re-renders both views from the book's pages and highlights. */
  setData(pages: Page[], highlights: Highlight[]): void {
    this.pages = pages;
    this.placed.clear();
    for (const page of pages) {
      const mine = highlights.filter((h) => h.pageId === page.id);
      this.placed.set(
        page.id,
        mine
          .map((h) => ({ h, range: page.text ? anchorHighlight(page.text, h) : null }))
          .sort((a, b) => (a.range?.start ?? Infinity) - (b.range?.start ?? Infinity)),
      );
    }
    this.renderRead();
    this.renderNotes();
  }

  // ---- Read view ----

  private renderRead(): void {
    if (!this.pages.some((p) => p.text?.trim())) {
      this.readEl.replaceChildren(
        el('p', 'empty', this.pages.length ? 'No text yet. Use “Read all text” in Pages first.' : 'No pages yet.'),
      );
      return;
    }
    this.readEl.replaceChildren(...this.pages.map((page, i) => this.renderPage(page, i + 1)));
  }

  private renderPage(page: Page, number: number): HTMLElement {
    const article = el('article', 'reader-page');
    article.dataset.pageId = String(page.id);

    const header = el('header', 'reader-page-header');
    const open = el('button', 'reader-page-label', `Page ${number}`);
    open.type = 'button';
    open.dataset.openPage = String(page.id);
    open.title = 'Show the page image';
    header.append(open);
    article.append(header);

    if (page.text?.trim()) {
      const text = el('div', 'reader-text');
      text.dataset.pageId = String(page.id);
      const placed = (this.placed.get(page.id) ?? []).filter((p) => p.range);
      const ranges = placed.map((p) => ({ ...p.range!, id: p.h.id }));
      for (const seg of segments(page.text.length, ranges)) {
        const piece = page.text.slice(seg.start, seg.end);
        if (!seg.ids.length) {
          text.append(piece);
          continue;
        }
        const top = placed.find((p) => p.h.id === seg.ids[seg.ids.length - 1])!.h;
        const mark = el('mark', `hl-${top.color}`, piece);
        mark.dataset.ids = seg.ids.join(',');
        if (seg.ids.some((id) => this.findHighlight(id)?.note)) mark.classList.add('has-note');
        text.append(mark);
      }
      article.append(text);
    } else {
      article.append(el('p', 'reader-missing', 'No text read for this page yet.'));
    }

    const noteRow = el('div', 'reader-note');
    if (page.note) noteRow.append(el('p', 'reader-note-text', page.note));
    const edit = el('button', 'link-button', page.note ? 'Edit note' : '+ Add a note');
    edit.type = 'button';
    edit.dataset.editNote = String(page.id);
    noteRow.append(edit);
    article.append(noteRow);
    return article;
  }

  private onSelectionChange(): void {
    const sel = window.getSelection();
    const container = sel && !sel.isCollapsed && sel.rangeCount ? this.selectionContainer(sel) : null;
    if (!container) {
      // Tapping the bar can collapse the selection first on touch screens; keep what was selected.
      if (this.barPressed) return;
      this.pending = null;
      this.selectionBar.hidden = true;
      return;
    }
    const page = this.pages.find((p) => p.id === Number(container.dataset.pageId));
    const range = sel!.getRangeAt(0);
    let start = offsetIn(container, range.startContainer, range.startOffset);
    let end = offsetIn(container, range.endContainer, range.endOffset);
    const text = page?.text ?? '';
    // Leave out whitespace at the edges of the selection.
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (!page || start >= end) {
      this.pending = null;
      this.selectionBar.hidden = true;
      return;
    }
    this.pending = { page, range: { start, end }, quote: text.slice(start, end) };
    this.selectionBar.hidden = false;
  }

  /** The page text element holding the whole selection, if it is inside a single one. */
  private selectionContainer(sel: Selection): HTMLElement | null {
    const find = (n: Node | null) =>
      (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('.reader-text') ?? null;
    const a = find(sel.anchorNode);
    return a && a === find(sel.focusNode) && this.readEl.contains(a) ? a : null;
  }

  private async highlightSelection(color: HighlightColor): Promise<void> {
    this.barPressed = false;
    const pending = this.pending;
    this.pending = null;
    this.selectionBar.hidden = true;
    window.getSelection()?.removeAllRanges();
    if (pending) await this.actions.addHighlight(pending.page, pending.range, pending.quote, color);
  }

  private findHighlight(id: number): Highlight | undefined {
    for (const list of this.placed.values()) {
      const found = list.find((p) => p.h.id === id);
      if (found) return found.h;
    }
    return undefined;
  }

  private async editHighlight(h: Highlight): Promise<void> {
    const n = this.pages.findIndex((p) => p.id === h.pageId) + 1;
    const result = await this.notes.open({
      title: `Highlight on page ${n}`,
      note: h.note,
      highlight: { quote: h.quote, color: h.color },
    });
    if (result?.action === 'delete') await this.actions.deleteHighlight(h);
    else if (result?.action === 'save') await this.actions.updateHighlight({ ...h, note: result.note, color: result.color });
  }

  private async editPageNote(page: Page): Promise<void> {
    const n = this.pages.findIndex((p) => p.id === page.id) + 1;
    const result = await this.notes.open({ title: `Note on page ${n}`, note: page.note ?? '' });
    if (result?.action === 'save' && result.note !== (page.note ?? '')) await this.actions.savePageNote(page, result.note);
  }

  /** Scrolls the read view to a page, briefly marking `range` in its text if given. */
  scrollTo(pageId: number, range?: Range): void {
    const article = this.readEl.querySelector<HTMLElement>(`.reader-page[data-page-id="${pageId}"]`);
    if (!article) return;
    const text = article.querySelector<HTMLElement>('.reader-text');
    const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: AbstractRange[]) => unknown }).Highlight;
    if (range && text && highlights && HighlightCtor) {
      const r = document.createRange();
      const s = pointAt(text, range.start);
      const e = pointAt(text, range.end);
      r.setStart(s.node, s.offset);
      r.setEnd(e.node, e.offset);
      highlights.set('search-flash', new HighlightCtor(r));
      window.clearTimeout(this.flashTimer);
      this.flashTimer = window.setTimeout(() => highlights.delete('search-flash'), FLASH_MS);
      (r.startContainer.parentElement ?? article).scrollIntoView({ block: 'center' });
    } else {
      article.scrollIntoView({ block: 'start' });
    }
  }

  // ---- Highlights & notes list ----

  private renderNotes(): void {
    const items: HTMLElement[] = [];
    this.pages.forEach((page, i) => {
      const placed = this.placed.get(page.id) ?? [];
      if (!page.note && !placed.length) return;
      const section = el('section', 'notes-page');
      section.append(el('h3', '', `Page ${i + 1}`));
      if (page.note) {
        const note = el('button', 'notes-item notes-page-note');
        note.type = 'button';
        note.append(el('span', 'notes-kind', 'Page note'), el('span', 'notes-body', page.note));
        note.addEventListener('click', () => this.onPick?.(page.id));
        section.append(note);
      }
      for (const { h, range } of placed) {
        const item = el('button', `notes-item notes-highlight hl-border-${h.color}`);
        item.type = 'button';
        item.append(el('span', 'notes-quote', `“${h.quote}”`));
        if (h.note) item.append(el('span', 'notes-body', h.note));
        if (!range) item.append(el('span', 'notes-kind', 'This passage is no longer in the page text'));
        item.addEventListener('click', () => this.onPick?.(page.id, range ?? undefined));
        section.append(item);
      }
      items.push(section);
    });
    this.notesEl.replaceChildren(
      ...(items.length
        ? items
        : [el('p', 'empty', 'No highlights or notes yet. In Read, select text to highlight it, or add a note to a page.')]),
    );
  }

  /** Called when an entry in the highlights list is tapped. */
  onPick: ((pageId: number, range?: Range) => void) | null = null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Character offset of a DOM position within `container`'s text. */
function offsetIn(container: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** The DOM position of a character offset within `container`'s text. */
function pointAt(container: Node, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let left = offset;
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (left <= n.data.length) return { node: n, offset: left };
    left -= n.data.length;
    last = n;
  }
  return last ? { node: last, offset: last.data.length } : { node: container, offset: 0 };
}
