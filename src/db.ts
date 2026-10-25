import { insertAt } from './order';
import type { Book, Highlight, Page, PageEdit, PageText } from './page';

/** Books and pages (with their photo blobs) stored in the browser; nothing leaves the device. */

const DB_NAME = 'book-scanner';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
        const pages = db.createObjectStore('pages', { keyPath: 'id', autoIncrement: true });
        pages.createIndex('bookId', 'bookId');
      }
      if (e.oldVersion < 2) {
        const highlights = db.createObjectStore('highlights', { keyPath: 'id', autoIncrement: true });
        highlights.createIndex('bookId', 'bookId');
        highlights.createIndex('pageId', 'pageId');
      }
    };
    req.onsuccess = () => {
      // Let a newer version of the app (another tab after an update) upgrade the database.
      req.result.onversionchange = () => {
        req.result.close();
        dbPromise = null;
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('The database is open in another tab with an older version.'));
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Runs `body` in one transaction and resolves with its result once the transaction commits. */
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await open();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
  });
  try {
    const result = await body(tx);
    await done;
    return result;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // Already finished or aborted.
    }
    done.catch(() => {});
    throw err;
  }
}

async function getBook(tx: IDBTransaction, id: number): Promise<Book> {
  const book = await request<Book | undefined>(tx.objectStore('books').get(id));
  if (!book) throw new Error(`Book ${id} not found.`);
  return book;
}

export async function listBooks(): Promise<Book[]> {
  const books = await transaction(['books'], 'readonly', (tx) => request<Book[]>(tx.objectStore('books').getAll()));
  return books.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createBook(title: string): Promise<Book> {
  const now = Date.now();
  const book: Omit<Book, 'id'> = { title, createdAt: now, updatedAt: now, pageIds: [] };
  const id = await transaction(['books'], 'readwrite', (tx) => request(tx.objectStore('books').add(book)));
  return { ...book, id: id as number };
}

export async function renameBook(id: number, title: string): Promise<Book> {
  return transaction(['books'], 'readwrite', async (tx) => {
    const book = { ...(await getBook(tx, id)), title, updatedAt: Date.now() };
    await request(tx.objectStore('books').put(book));
    return book;
  });
}

export async function deleteBook(id: number): Promise<void> {
  await transaction(['books', 'pages', 'highlights'], 'readwrite', async (tx) => {
    for (const name of ['pages', 'highlights']) {
      const store = tx.objectStore(name);
      const keys = await request(store.index('bookId').getAllKeys(id));
      await Promise.all(keys.map((k) => request(store.delete(k))));
    }
    await request(tx.objectStore('books').delete(id));
  });
}

/** The book's pages in reading order. */
export async function getPages(book: Book): Promise<Page[]> {
  const pages = await transaction(['pages'], 'readonly', (tx) =>
    request<Page[]>(tx.objectStore('pages').index('bookId').getAll(book.id)),
  );
  const byId = new Map(pages.map((p) => [p.id, p]));
  return book.pageIds.map((id) => byId.get(id)).filter((p): p is Page => p !== undefined);
}

/** One page by id (used for library covers). */
export async function getPage(id: number): Promise<Page | undefined> {
  return transaction(['pages'], 'readonly', (tx) => request<Page | undefined>(tx.objectStore('pages').get(id)));
}

/** Stores a new page at `index` in the book (the end by default). */
export async function addPage(
  bookId: number,
  original: Blob,
  index = Infinity,
): Promise<{ page: Page; book: Book }> {
  return transaction(['books', 'pages'], 'readwrite', async (tx) => {
    const book = await getBook(tx, bookId);
    const data: Omit<Page, 'id'> = { bookId, createdAt: Date.now(), original, edit: null, image: original };
    const id = (await request(tx.objectStore('pages').add(data))) as number;
    const updated: Book = { ...book, pageIds: insertAt(book.pageIds, id, index), updatedAt: Date.now() };
    await request(tx.objectStore('books').put(updated));
    return { page: { ...data, id }, book: updated };
  });
}

async function putPage(page: Page): Promise<Page> {
  await transaction(['pages'], 'readwrite', (tx) => request(tx.objectStore('pages').put(page)));
  return page;
}

/** Saves a new processed image. OCR text read from the old image is dropped unless hand-corrected. */
export async function updatePageImage(page: Page, edit: PageEdit, image: Blob): Promise<Page> {
  const text: PageText = page.textEdited ? {} : { text: null, textConfidence: null };
  return putPage({ ...page, ...text, edit, image });
}

export async function updatePageText(page: Page, text: PageText): Promise<Page> {
  return putPage({ ...page, ...text });
}

export async function updatePageNote(page: Page, note: string): Promise<Page> {
  return putPage({ ...page, note });
}

/** Every page of every book, for searching the whole library. */
export async function allPages(): Promise<Page[]> {
  return transaction(['pages'], 'readonly', (tx) => request<Page[]>(tx.objectStore('pages').getAll()));
}

export async function getHighlights(bookId?: number): Promise<Highlight[]> {
  return transaction(['highlights'], 'readonly', (tx) => {
    const store = tx.objectStore('highlights');
    return request<Highlight[]>(bookId === undefined ? store.getAll() : store.index('bookId').getAll(bookId));
  });
}

export async function addHighlight(h: Omit<Highlight, 'id'>): Promise<Highlight> {
  const id = await transaction(['highlights'], 'readwrite', (tx) => request(tx.objectStore('highlights').add(h)));
  return { ...h, id: id as number };
}

export async function updateHighlight(h: Highlight): Promise<Highlight> {
  await transaction(['highlights'], 'readwrite', (tx) => request(tx.objectStore('highlights').put(h)));
  return h;
}

export async function deleteHighlight(id: number): Promise<void> {
  await transaction(['highlights'], 'readwrite', (tx) => request(tx.objectStore('highlights').delete(id)));
}

export async function deletePage(bookId: number, pageId: number): Promise<Book> {
  return transaction(['books', 'pages', 'highlights'], 'readwrite', async (tx) => {
    const book = await getBook(tx, bookId);
    const updated: Book = { ...book, pageIds: book.pageIds.filter((id) => id !== pageId), updatedAt: Date.now() };
    const highlights = tx.objectStore('highlights');
    const keys = await request(highlights.index('pageId').getAllKeys(pageId));
    await Promise.all(keys.map((k) => request(highlights.delete(k))));
    await request(tx.objectStore('pages').delete(pageId));
    await request(tx.objectStore('books').put(updated));
    return updated;
  });
}

export async function setPageOrder(bookId: number, pageIds: number[]): Promise<Book> {
  return transaction(['books'], 'readwrite', async (tx) => {
    const updated: Book = { ...(await getBook(tx, bookId)), pageIds, updatedAt: Date.now() };
    await request(tx.objectStore('books').put(updated));
    return updated;
  });
}

/** Asks the browser not to evict our data when the device runs low on space. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.usage !== undefined && e.quota !== undefined ? { usage: e.usage, quota: e.quota } : null;
  } catch {
    return null;
  }
}
