import { Camera, CameraUnavailable, normalizePhoto } from './camera';
import * as db from './db';
import { PageEditor, initialEdit } from './editor';
import { ExportPanel } from './exportpanel';
import { NoteDialog } from './notedialog';
import { ocrLanguage, recognize, type OcrProgress } from './ocr';
import { moveItem } from './order';
import type { Book, Highlight, Page, PageEdit } from './page';
import { renderPage } from './processing';
import { registerServiceWorker, setupInstallCard } from './pwa';
import { Reader } from './reader';
import type { Range } from './search';
import { renderHits, searchBooks, type SearchHit } from './searchview';
import { TextPanel, bindLanguageSelect } from './textpanel';

type View = 'library' | 'pages' | 'scanner';
type Tab = 'pages' | 'read' | 'notes';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const views: Record<View, HTMLElement> = {
  library: $('library'),
  pages: $('pages'),
  scanner: $('scanner'),
};
const backButton = $<HTMLButtonElement>('back');
const title = $<HTMLHeadingElement>('title');
const pageCount = $<HTMLSpanElement>('page-count');
const bookList = $<HTMLUListElement>('book-list');
const libraryEmpty = $<HTMLParagraphElement>('library-empty');
const storage = $<HTMLParagraphElement>('storage');
const video = $<HTMLVideoElement>('video');
const shutter = $<HTMLButtonElement>('shutter');
const torchButton = $<HTMLButtonElement>('torch');
const flash = $<HTMLDivElement>('flash');
const lastThumb = $<HTMLImageElement>('last-thumb');
const insertChip = $<HTMLDivElement>('insert-chip');
const insertText = $<HTMLSpanElement>('insert-text');
const cameraMessage = $<HTMLDivElement>('camera-message');
const cameraMessageText = $<HTMLParagraphElement>('camera-message-text');
const retryCamera = $<HTMLButtonElement>('retry-camera');
const pageGrid = $<HTMLOListElement>('page-grid');
const pagesEmpty = $<HTMLParagraphElement>('pages-empty');
const cleanAll = $<HTMLButtonElement>('clean-all');
const readAll = $<HTMLButtonElement>('read-all');
const exportButton = $<HTMLButtonElement>('export');
const viewer = $<HTMLDialogElement>('viewer');
const viewerImg = $<HTMLImageElement>('viewer-img');
const viewerLabel = $<HTMLSpanElement>('viewer-label');
const viewerPrev = $<HTMLButtonElement>('viewer-prev');
const viewerNext = $<HTMLButtonElement>('viewer-next');
const editor = new PageEditor($<HTMLDialogElement>('editor'));
const textPanel = new TextPanel($<HTMLDialogElement>('text-panel'), {
  read: readPageText,
  save: (page, text) => savePage(db.updatePageText(page, { text, textEdited: true })),
});
bindLanguageSelect($<HTMLSelectElement>('pages-language'));
const exportPanel = new ExportPanel($<HTMLDialogElement>('export-panel'));
const camera = new Camera(video);
const librarySearch = $<HTMLInputElement>('library-search');
const libraryResults = $<HTMLDivElement>('library-results');
const bookSearch = $<HTMLInputElement>('book-search');
const bookResults = $<HTMLDivElement>('book-results');
const reader = new Reader(
  document.querySelector<HTMLElement>('[data-panel="read"]')!,
  document.querySelector<HTMLElement>('[data-panel="notes"]')!,
  $('selection-bar'),
  new NoteDialog($<HTMLDialogElement>('note-dialog')),
  {
    addHighlight: async (page, range, quote, color) => {
      const h = await db.addHighlight({
        bookId: page.bookId,
        pageId: page.id,
        start: range.start,
        end: range.end,
        quote,
        color,
        note: '',
        createdAt: Date.now(),
      });
      highlights = [...highlights, h];
      renderPages();
    },
    updateHighlight: async (h) => {
      await db.updateHighlight(h);
      highlights = highlights.map((x) => (x.id === h.id ? h : x));
      renderPages();
    },
    deleteHighlight: async (h) => {
      await db.deleteHighlight(h.id);
      highlights = highlights.filter((x) => x.id !== h.id);
      renderPages();
    },
    savePageNote: async (page, note) => {
      await savePage(db.updatePageNote(page, note));
    },
    openPage: (page) => openViewer(page),
  },
);
reader.onPick = (pageId, range) => jumpTo(pageId, range);

let view: View = 'library';
let book: Book | null = null;
/** Pages of the open book, in reading order. */
let pages: Page[] = [];
let viewing: Page | null = null;
/** Highlights of the open book. */
let highlights: Highlight[] = [];
let tab: Tab = 'pages';
/** Where the next capture goes in the open book; null appends at the end. */
let insertIndex: number | null = null;

// Object URLs for page images, recreated when a page's image changes.
const urls = new Map<number, { blob: Blob; url: string }>();

function pageUrl(page: Page): string {
  const cached = urls.get(page.id);
  if (cached?.blob === page.image) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(page.image);
  urls.set(page.id, { blob: page.image, url });
  return url;
}

function releaseUrls(): void {
  for (const { url } of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function report(action: string, err: unknown): void {
  alert(`${action}: ${err instanceof Error ? err.message : String(err)}`);
}

// ---- Navigation ----

function showView(next: View): void {
  view = next;
  for (const [name, el] of Object.entries(views)) el.hidden = name !== next;
  backButton.hidden = next === 'library';
  if (next === 'scanner') void startCamera();
  else {
    // Release the camera while it is off screen (saves battery, turns the torch off).
    camera.stop();
    torchButton.setAttribute('aria-pressed', 'false');
  }
  renderHeader();
}

function renderHeader(): void {
  title.textContent = view === 'library' || !book ? 'Book Scanner' : book.title;
  pageCount.textContent = view === 'library' ? '' : plural(pages.length, 'page');
}

backButton.addEventListener('click', () => {
  if (view === 'scanner') showView('pages');
  else void openLibrary();
});

// ---- Library ----

let coverUrls: string[] = [];

async function openLibrary(): Promise<void> {
  book = null;
  pages = [];
  highlights = [];
  insertIndex = null;
  releaseUrls();
  librarySearch.value = '';
  showLibraryResults(false);
  showView('library');
  await renderLibrary();
}

function showLibraryResults(on: boolean): void {
  libraryResults.hidden = !on;
  bookList.hidden = on;
  if (on) libraryEmpty.hidden = true;
}

/** Searches every book; results open the book at the match. */
async function searchLibrary(query: string): Promise<void> {
  if (!query.trim()) {
    showLibraryResults(false);
    await renderLibrary();
    return;
  }
  const [books, allPages, allHighlights] = await Promise.all([db.listBooks(), db.allPages(), db.getHighlights()]);
  // A newer keystroke may have replaced this query.
  if (librarySearch.value !== query) return;
  const result = searchBooks(books, new Map(allPages.map((p) => [p.id, p])), allHighlights, query);
  renderHits(libraryResults, result, true, (hit) => void openHit(hit));
  showLibraryResults(true);
}

async function openHit(hit: SearchHit): Promise<void> {
  await openBook(hit.book);
  jumpTo(hit.page.id, hit.range);
}

async function renderLibrary(): Promise<void> {
  const books = await db.listBooks();
  coverUrls.forEach((u) => URL.revokeObjectURL(u));
  coverUrls = [];
  const items = await Promise.all(
    books.map(async (b) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'book-card';
      const cover = document.createElement('img');
      cover.className = 'book-cover';
      cover.alt = '';
      const first = b.pageIds[0] !== undefined ? await db.getPage(b.pageIds[0]) : undefined;
      if (first) {
        const url = URL.createObjectURL(first.image);
        coverUrls.push(url);
        cover.src = url;
      }
      const info = document.createElement('span');
      info.className = 'book-info';
      const name = document.createElement('span');
      name.className = 'book-title';
      name.textContent = b.title;
      const meta = document.createElement('span');
      meta.className = 'book-meta';
      meta.textContent = `${plural(b.pageIds.length, 'page')} · ${new Date(b.updatedAt).toLocaleDateString()}`;
      info.append(name, meta);
      button.append(cover, info);
      button.addEventListener('click', () => void openBook(b));
      li.append(button);
      return li;
    }),
  );
  if (view !== 'library') return;
  bookList.replaceChildren(...items);
  libraryEmpty.hidden = books.length > 0;

  const est = await db.storageEstimate();
  storage.textContent = est
    ? `Using ${(est.usage / 1e6).toFixed(1)} MB of ${(est.quota / 1e9).toFixed(1)} GB available on this device.`
    : '';
}

$('new-book').addEventListener('click', async () => {
  const name = prompt('Book title', 'My book')?.trim();
  if (!name) return;
  try {
    const created = await db.createBook(name);
    // Ask once there is something worth keeping.
    void db.requestPersistence();
    await openBook(created);
  } catch (err) {
    report('Could not create the book', err);
  }
});

// ---- Book ----

async function openBook(b: Book): Promise<void> {
  book = b;
  insertIndex = null;
  releaseUrls();
  [pages, highlights] = await Promise.all([db.getPages(b), db.getHighlights(b.id)]);
  bookSearch.value = '';
  bookResults.hidden = true;
  showTab('pages');
  showView('pages');
  renderPages();
}

function showTab(next: Tab): void {
  tab = next;
  bookResults.hidden = true;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === next));
  }
  for (const panel of document.querySelectorAll<HTMLElement>('[data-panel]')) panel.hidden = panel.dataset.panel !== next;
}

/** Opens the Read tab at a page, marking `range` if given. */
function jumpTo(pageId: number, range?: Range): void {
  bookSearch.value = '';
  showTab('read');
  // Wait a frame so the panel is laid out before scrolling.
  requestAnimationFrame(() => reader.scrollTo(pageId, range));
}

function searchBook(query: string): void {
  if (!book || !query.trim()) {
    showTab(tab);
    return;
  }
  const result = searchBooks([book], new Map(pages.map((p) => [p.id, p])), highlights, query);
  renderHits(bookResults, result, false, (hit) => jumpTo(hit.page.id, hit.range));
  for (const panel of document.querySelectorAll<HTMLElement>('[data-panel]')) panel.hidden = true;
  bookResults.hidden = false;
}

function renderPages(): void {
  renderHeader();
  reader.setData(pages, highlights);
  const last = pages[pages.length - 1];
  lastThumb.hidden = !last;
  if (last) lastThumb.src = pageUrl(last);

  insertChip.hidden = insertIndex === null;
  if (insertIndex !== null) insertText.textContent = `Adding after page ${insertIndex}`;

  pagesEmpty.hidden = pages.length > 0;
  if (!cleanAll.disabled) cleanAll.hidden = !pages.some((p) => !p.edit);
  if (!readAll.disabled) readAll.hidden = !pages.some((p) => p.text == null);
  exportButton.hidden = pages.length === 0;
  pageGrid.replaceChildren(
    ...pages.map((page, i) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'page-tile';
      button.setAttribute('aria-label', `Open page ${i + 1}`);
      const img = document.createElement('img');
      img.src = pageUrl(page);
      img.alt = '';
      img.loading = 'lazy';
      const label = document.createElement('span');
      label.className = 'number';
      label.textContent = String(i + 1);
      button.append(img, label);
      if (page.edit) {
        const badge = document.createElement('span');
        badge.className = 'edited';
        badge.textContent = '✓';
        badge.title = 'Cleaned';
        button.append(badge);
      }
      if (page.text != null) {
        const text = document.createElement('span');
        text.className = 'has-text';
        text.textContent = 'Aa';
        text.title = 'Text read';
        button.append(text);
      }
      button.addEventListener('click', () => openViewer(page));
      li.append(button);
      return li;
    }),
  );
}

async function addPage(blob: Blob): Promise<void> {
  if (!book) return;
  const target = book;
  const { page, book: updated } = await db.addPage(target.id, blob, insertIndex ?? Infinity);
  // The user may have left the book while this was saving.
  if (book?.id !== target.id) return;
  book = updated;
  const byId = new Map([...pages, page].map((p) => [p.id, p]));
  pages = updated.pageIds.map((id) => byId.get(id)).filter((p): p is Page => p !== undefined);
  // Keep inserting in sequence after the page just added.
  if (insertIndex !== null) insertIndex++;
  renderPages();
}

/** Waits for a page write, then swaps the stored version into the open book. */
async function savePage(write: Promise<Page>): Promise<Page> {
  const updated = await write;
  const i = pages.findIndex((p) => p.id === updated.id);
  if (i >= 0) pages[i] = updated;
  if (viewing?.id === updated.id) viewing = updated;
  renderPages();
  return updated;
}

async function setPageImage(page: Page, edit: PageEdit, image: Blob): Promise<void> {
  await savePage(db.updatePageImage(page, edit, image));
}

async function readPageText(page: Page, progress?: (p: OcrProgress) => void): Promise<Page> {
  const { text, confidence } = await recognize(page.image, ocrLanguage(), progress);
  // Use the latest stored version, in case the page changed while reading.
  const current = pages.find((p) => p.id === page.id) ?? page;
  return savePage(db.updatePageText(current, { text, textConfidence: confidence, textEdited: false }));
}

/** Runs OCR on every page that has no text yet. */
async function readAllPages(): Promise<void> {
  const todo = pages.filter((p) => p.text == null);
  readAll.disabled = true;
  try {
    for (const [i, page] of todo.entries()) {
      const label = `Reading ${i + 1}/${todo.length}`;
      readAll.textContent = `${label}…`;
      const current = pages.find((p) => p.id === page.id);
      if (!current || current.text != null) continue;
      await readPageText(current, (p) => {
        readAll.textContent = p.stage === 'Reading text' ? `${label} · ${Math.round(p.progress * 100)}%` : `${p.stage}…`;
      });
    }
  } catch (err) {
    report('Could not read the text', err);
  } finally {
    readAll.disabled = false;
    readAll.textContent = 'Read all text';
    renderPages();
  }
}

async function editPage(page: Page): Promise<void> {
  const result = await editor.open(page);
  // The page may have been deleted meanwhile.
  if (result && pages.some((p) => p.id === page.id)) {
    await setPageImage(page, result.edit, result.image).catch((err) => report('Could not save the page', err));
  }
}

/** Auto-detects and filters every page that was never edited. */
async function cleanAllPages(): Promise<void> {
  const todo = pages.filter((p) => !p.edit);
  cleanAll.disabled = true;
  try {
    for (const [i, page] of todo.entries()) {
      cleanAll.textContent = `Cleaning ${i + 1}/${todo.length}…`;
      const edit = await initialEdit(page.original);
      const image = await renderPage(page.original, edit);
      const current = pages.find((p) => p.id === page.id);
      if (current && !current.edit) await setPageImage(current, edit, image);
    }
  } catch (err) {
    report('Could not clean a page', err);
  } finally {
    cleanAll.disabled = false;
    cleanAll.textContent = 'Clean all';
    renderPages();
  }
}

async function deletePage(page: Page): Promise<void> {
  if (!book) return;
  const index = pages.findIndex((p) => p.id === page.id);
  book = await db.deletePage(book.id, page.id);
  pages = pages.filter((p) => p.id !== page.id);
  highlights = highlights.filter((h) => h.pageId !== page.id);
  const cached = urls.get(page.id);
  if (cached) URL.revokeObjectURL(cached.url);
  urls.delete(page.id);
  if (insertIndex !== null && index < insertIndex) insertIndex--;
  renderPages();
}

async function movePage(page: Page, to: number): Promise<void> {
  if (!book) return;
  const from = pages.findIndex((p) => p.id === page.id);
  pages = moveItem(pages, from, to);
  book = await db.setPageOrder(book.id, pages.map((p) => p.id));
  renderPages();
}

async function addFiles(files: FileList | null): Promise<void> {
  for (const file of Array.from(files ?? [])) {
    try {
      await addPage(await normalizePhoto(file));
    } catch (err) {
      report(`Could not add ${file.name}`, err);
    }
  }
}

$('scan').addEventListener('click', () => showView('scanner'));
cleanAll.addEventListener('click', () => void cleanAllPages());
readAll.addEventListener('click', () => void readAllPages());
exportButton.addEventListener('click', () => {
  if (book) exportPanel.open(book, pages, highlights);
});

for (const id of ['file-input', 'file-input-2']) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener('change', async () => {
    await addFiles(input.files);
    input.value = '';
  });
}

$('rename-book').addEventListener('click', async () => {
  if (!book) return;
  const name = prompt('Book title', book.title)?.trim();
  if (!name || name === book.title) return;
  try {
    book = await db.renameBook(book.id, name);
    renderHeader();
  } catch (err) {
    report('Could not rename the book', err);
  }
});

$('delete-book').addEventListener('click', async () => {
  if (!book) return;
  if (!confirm(`Delete “${book.title}” and its ${plural(pages.length, 'page')}? This cannot be undone.`)) return;
  try {
    await db.deleteBook(book.id);
    await openLibrary();
  } catch (err) {
    report('Could not delete the book', err);
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
  button.addEventListener('click', () => {
    bookSearch.value = '';
    showTab(button.dataset.tab as Tab);
  });
}

function debounce(fn: (q: string) => void, ms: number): (q: string) => void {
  let timer: number | undefined;
  return (q) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(q), ms);
  };
}

const searchBookSoon = debounce(searchBook, 200);
bookSearch.addEventListener('input', () => searchBookSoon(bookSearch.value));
const searchLibrarySoon = debounce((q) => void searchLibrary(q).catch((err) => report('Search failed', err)), 250);
librarySearch.addEventListener('input', () => searchLibrarySoon(librarySearch.value));

// ---- Scanner ----

async function startCamera(): Promise<void> {
  cameraMessage.hidden = true;
  try {
    await camera.start();
    shutter.disabled = false;
    torchButton.hidden = !camera.hasTorch;
  } catch (err) {
    shutter.disabled = true;
    cameraMessageText.textContent =
      err instanceof CameraUnavailable ? err.message : 'Could not open the camera.';
    // Retrying cannot help on plain HTTP or without camera support.
    retryCamera.hidden = err instanceof CameraUnavailable && (err.reason === 'insecure' || err.reason === 'unsupported');
    cameraMessage.hidden = false;
  }
}

shutter.addEventListener('click', async () => {
  shutter.disabled = true;
  try {
    flash.classList.remove('on');
    void flash.offsetWidth; // restart the flash animation
    flash.classList.add('on');
    navigator.vibrate?.(30);
    await addPage(await camera.capture());
  } catch (err) {
    report('Could not save the page', err);
  } finally {
    shutter.disabled = !camera.active;
  }
});

torchButton.addEventListener('click', async () => {
  await camera.setTorch(!camera.torch);
  torchButton.setAttribute('aria-pressed', String(camera.torch));
});

retryCamera.addEventListener('click', () => void startCamera());
$('open-pages').addEventListener('click', () => showView('pages'));
$('insert-cancel').addEventListener('click', () => {
  insertIndex = null;
  renderPages();
});

// Stop the camera when the tab is hidden and resume when it comes back.
document.addEventListener('visibilitychange', () => {
  if (view !== 'scanner') return;
  if (document.hidden) camera.stop();
  else void startCamera();
});

// ---- Viewer ----

function openViewer(page: Page): void {
  viewing = page;
  renderViewer();
  if (!viewer.open) viewer.showModal();
}

function renderViewer(): void {
  if (!viewing) return;
  const i = pages.findIndex((p) => p.id === viewing!.id);
  viewerImg.src = pageUrl(viewing);
  viewerLabel.textContent = `Page ${i + 1} of ${pages.length}`;
  viewerPrev.disabled = i <= 0;
  viewerNext.disabled = i >= pages.length - 1;
}

function step(delta: number): void {
  if (!viewing) return;
  const next = pages[pages.findIndex((p) => p.id === viewing!.id) + delta];
  if (next) openViewer(next);
}

viewerPrev.addEventListener('click', () => step(-1));
viewerNext.addEventListener('click', () => step(1));
viewer.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
});

$('viewer-close').addEventListener('click', () => viewer.close());
$('viewer-text').addEventListener('click', () => {
  if (!viewing) return;
  textPanel.open(viewing, `Page ${pages.findIndex((p) => p.id === viewing!.id) + 1} text`);
});
$('viewer-edit').addEventListener('click', () => {
  const page = viewing;
  viewer.close();
  if (page) void editPage(page);
});
$('viewer-delete').addEventListener('click', async () => {
  if (!viewing || !confirm('Delete this page?')) return;
  try {
    await deletePage(viewing);
    viewer.close();
  } catch (err) {
    report('Could not delete the page', err);
  }
});
$('viewer-move').addEventListener('click', async () => {
  if (!viewing) return;
  const current = pages.findIndex((p) => p.id === viewing!.id) + 1;
  const answer = prompt(`Move to position (1–${pages.length})`, String(current));
  const to = Number(answer);
  if (!answer || !Number.isInteger(to) || to === current) return;
  try {
    await movePage(viewing, Math.min(Math.max(to, 1), pages.length) - 1);
    renderViewer();
  } catch (err) {
    report('Could not move the page', err);
  }
});
$('viewer-insert').addEventListener('click', () => {
  if (!viewing) return;
  insertIndex = pages.findIndex((p) => p.id === viewing!.id) + 1;
  viewer.close();
  renderPages();
  showView('scanner');
});
viewer.addEventListener('close', () => {
  viewing = null;
  viewerImg.removeAttribute('src');
});

registerServiceWorker($('update-toast'), $<HTMLButtonElement>('update-reload'));
setupInstallCard($('install-card'), $('install-text'), $<HTMLButtonElement>('install-button'), $('install-dismiss'));

void openLibrary().catch((err) => report('Could not open the library', err));
