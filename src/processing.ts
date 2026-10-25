import type { Quad, Rotation } from './geometry';
import type { PageEdit } from './page';

export type WorkerRequest =
  | { id: number; type: 'render'; original: Blob; edit: PageEdit }
  | { id: number; type: 'detect'; original: Blob; rotation: Rotation }
  | { id: number; type: 'shrink'; image: Blob; maxSide: number; quality: number };

export type WorkerResponse =
  | { id: number; ok: true; blob?: Blob; corners?: Quad | null }
  | { id: number; ok: false; error: string };

type Pending = { resolve: (r: WorkerResponse & { ok: true }) => void; reject: (e: Error) => void };

// One worker keeps the heavy pixel work off the UI thread; requests run in order.
let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;

// Omit applied to each member of the union, so each request type keeps its own fields.
type RequestBody = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never;

function call(req: RequestBody): Promise<WorkerResponse & { ok: true }> {
  if (!worker) {
    worker = new Worker(new URL('./process.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error));
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ ...req, id });
  });
}

/** Flattens, crops and filters the original photo into the clean page image. */
export async function renderPage(original: Blob, edit: PageEdit): Promise<Blob> {
  return (await call({ type: 'render', original, edit })).blob!;
}

/** Finds the page corners in the photo (turned by `rotation`), or null if none stand out. */
export async function detectCorners(original: Blob, rotation: Rotation): Promise<Quad | null> {
  return (await call({ type: 'detect', original, rotation })).corners ?? null;
}

/** Re-encodes an image smaller (longest side at most `maxSide`), e.g. for a lighter PDF. */
export async function shrinkImage(image: Blob, maxSide: number, quality: number): Promise<Blob> {
  return (await call({ type: 'shrink', image, maxSide, quality })).blob!;
}
