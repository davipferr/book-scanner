import { quadOutputSize, scaleQuad, type Rotation } from './geometry';
import type { PageEdit } from './page';
import { applyFilter, detectPage, warpPerspective } from './raster';
import { MAX_PAGE_SIDE, fitWithin } from './size';
import type { WorkerRequest, WorkerResponse } from './processing';

/** Longest side used for page detection; plenty for finding four corners, and fast. */
const DETECT_SIDE = 320;

/** Draws the photo turned clockwise by `rotation`, scaled so its longest side is at most `maxSide`. */
function drawRotated(bitmap: ImageBitmap, rotation: Rotation, maxSide: number): OffscreenCanvas {
  const turned = rotation === 90 || rotation === 270;
  const size = fitWithin(
    turned ? { width: bitmap.height, height: bitmap.width } : { width: bitmap.width, height: bitmap.height },
    maxSide,
  );
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const [dw, dh] = turned ? [size.height, size.width] : [size.width, size.height];
  ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh);
  return canvas;
}

async function render(original: Blob, edit: PageEdit): Promise<Blob> {
  const bitmap = await createImageBitmap(original);
  const canvas = drawRotated(bitmap, edit.rotation, Infinity);
  bitmap.close();
  const src = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const quad = scaleQuad(edit.corners, canvas.width, canvas.height);
  const size = fitWithin(quadOutputSize(quad), MAX_PAGE_SIDE);
  const page = warpPerspective(src, quad, size.width, size.height);
  applyFilter(page, edit.filter);
  const out = new OffscreenCanvas(size.width, size.height);
  out.getContext('2d')!.putImageData(new ImageData(page.data as Uint8ClampedArray<ArrayBuffer>, size.width, size.height), 0, 0);
  return out.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
}

async function detect(original: Blob, rotation: Rotation) {
  const bitmap = await createImageBitmap(original);
  const canvas = drawRotated(bitmap, rotation, DETECT_SIDE);
  bitmap.close();
  return detectPage(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height));
}

async function shrink(image: Blob, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const canvas = drawRotated(bitmap, 0, maxSide);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  let res: WorkerResponse;
  try {
    if (req.type === 'render') res = { id: req.id, ok: true, blob: await render(req.original, req.edit) };
    else if (req.type === 'shrink') res = { id: req.id, ok: true, blob: await shrink(req.image, req.maxSide, req.quality) };
    else res = { id: req.id, ok: true, corners: await detect(req.original, req.rotation) };
  } catch (err) {
    res = { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(res);
};
