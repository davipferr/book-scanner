import type { Worker as TesseractWorker } from 'tesseract.js';
import { reflowText } from './text';

/**
 * Text recognition with Tesseract.js. It runs in its own worker, served from this site; the
 * engine (~4 MB) and the language data (a few MB, from jsDelivr) download on first use and
 * are then cached, so reading works offline afterwards.
 */

export const OCR_LANGUAGES = {
  por: 'Portuguese',
  'por+eng': 'Portuguese + English',
  eng: 'English',
  spa: 'Spanish',
} as const;

export type OcrLanguage = keyof typeof OCR_LANGUAGES;

const LANGUAGE_KEY = 'book-scanner.ocr-language';

export function ocrLanguage(): OcrLanguage {
  try {
    const v = localStorage.getItem(LANGUAGE_KEY);
    if (v && v in OCR_LANGUAGES) return v as OcrLanguage;
  } catch {
    // Storage can be blocked; use the default.
  }
  // Portuguese alone keeps accents better than mixed with English ("não", not "nao").
  return 'por';
}

export function setOcrLanguage(lang: OcrLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Not important enough to report.
  }
}

export interface OcrProgress {
  /** What Tesseract is doing, in plain words. */
  stage: string;
  /** 0..1 within the stage. */
  progress: number;
}

export interface OcrResult {
  text: string;
  /** Mean word confidence, 0..100. */
  confidence: number;
}

let worker: { lang: OcrLanguage; ready: Promise<TesseractWorker> } | null = null;
let onProgress: ((p: OcrProgress) => void) | null = null;
// Jobs run one at a time so progress reports belong to the current one.
let queue: Promise<unknown> = Promise.resolve();

/** Fraction of each page edge skipped by OCR; slivers of table there read as "|" or "&". */
const EDGE_MARGIN = 0.015;

const STAGES: Record<string, string> = {
  'loading tesseract core': 'Loading the text reader',
  'initializing tesseract': 'Starting the text reader',
  'loading language traineddata': 'Downloading language data',
  'loading language traineddata (from cache)': 'Loading language data',
  'initializing api': 'Starting the text reader',
  'recognizing text': 'Reading text',
};

function getWorker(lang: OcrLanguage): Promise<TesseractWorker> {
  if (worker?.lang === lang) return worker.ready;
  const previous = worker;
  const ready = (async () => {
    if (previous) await (await previous.ready.catch(() => null))?.terminate();
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker(lang.split('+'), OEM.LSTM_ONLY, {
      workerPath: new URL(__OCR_WORKER_PATH__, document.baseURI).href,
      corePath: new URL(__OCR_CORE_PATH__, document.baseURI).href,
      // A same-origin worker script (not a blob) so the service worker can serve it offline.
      workerBlobURL: false,
      logger: (m) => onProgress?.({ stage: STAGES[m.status] ?? m.status, progress: m.progress }),
    });
  })();
  worker = { lang, ready };
  // Let a failed start (e.g. offline) be retried next time.
  ready.catch(() => {
    if (worker?.ready === ready) worker = null;
  });
  return ready;
}

/** Reads the text in a page image, reporting progress while it works. */
export function recognize(
  image: Blob,
  lang: OcrLanguage,
  progress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const job = queue.then(async () => {
    onProgress = progress ?? null;
    try {
      const w = await getWorker(lang);
      const { data } = await w.recognize(await trimEdges(image));
      return { text: reflowText(data.text), confidence: Math.round(data.confidence) };
    } catch (err) {
      if (!navigator.onLine) {
        throw new Error('You are offline. The first time you read text, the app needs internet to download the text reader.');
      }
      throw err;
    } finally {
      onProgress = null;
    }
  });
  queue = job.catch(() => {});
  return job;
}

async function trimEdges(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const mx = Math.round(bitmap.width * EDGE_MARGIN);
  const my = Math.round(bitmap.height * EDGE_MARGIN);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width - 2 * mx;
  canvas.height = bitmap.height - 2 * my;
  canvas.getContext('2d')!.drawImage(bitmap, -mx, -my);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the page.'))), 'image/png'),
  );
}
