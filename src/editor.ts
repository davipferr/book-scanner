import {
  FULL_QUAD,
  addRotation,
  isConvexQuad,
  rotateQuadCW,
  insetQuad,
  type Point,
} from './geometry';
import type { Page, PageEdit } from './page';
import { detectCorners, renderPage } from './processing';
import type { PageFilter } from './raster';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** How close (CSS px) a touch must land to grab a corner; fingers are imprecise. */
const GRAB_RADIUS = 48;
const LOUPE_ZOOM = 2.5;
/** Loupe diameter in CSS px (matches .loupe in style.css). */
const LOUPE_SIZE = 120;
const FILTER_KEY = 'book-scanner.filter';

export interface EditResult {
  edit: PageEdit;
  image: Blob;
}

/** The filter picked last time, used as the default for new edits. */
export function lastFilter(): PageFilter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    if (v === 'original' || v === 'gray' || v === 'document') return v;
  } catch {
    // Storage can be blocked; fall through to the default.
  }
  return 'document';
}

function rememberFilter(filter: PageFilter): void {
  try {
    localStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Not important enough to report.
  }
}

/** How far detected corners are pulled toward the page center, so no table shows at the edges. */
const DETECT_INSET = 0.006;

/** Corners for a page that has never been edited: detected, or a small inset from the photo edges. */
export async function initialEdit(original: Blob): Promise<PageEdit> {
  const found = await detectCorners(original, 0).catch(() => null);
  const detected = found && insetQuad(found, DETECT_INSET);
  const inset = 0.03;
  return {
    rotation: 0,
    filter: lastFilter(),
    corners: detected ?? [
      { x: inset, y: inset },
      { x: 1 - inset, y: inset },
      { x: 1 - inset, y: 1 - inset },
      { x: inset, y: 1 - inset },
    ],
  };
}

/** Full-screen dialog to drag the page corners, rotate, and pick a filter. */
export class PageEditor {
  private readonly stage: HTMLDivElement;
  private readonly frame: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: SVGSVGElement;
  private readonly previewImg: HTMLImageElement;
  private readonly loupe: HTMLCanvasElement;
  private readonly status: HTMLParagraphElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly previewButton: HTMLButtonElement;
  private readonly polygon = document.createElementNS(SVG_NS, 'polygon');
  private readonly handles: SVGCircleElement[] = [];

  private page: Page | null = null;
  private bitmap: ImageBitmap | null = null;
  private edit: PageEdit = { rotation: 0, corners: FULL_QUAD, filter: 'document' };
  private displaySize = { width: 0, height: 0 };
  private dragging: number | null = null;
  private previewing = false;
  private preview: { key: string; blob: Blob; url: string } | null = null;
  private previewToken = 0;
  private settle: ((r: EditResult | null) => void) | null = null;

  constructor(private readonly dialog: HTMLDialogElement) {
    const $ = <T extends Element>(sel: string) => dialog.querySelector(sel) as T;
    this.stage = $('.editor-stage');
    this.frame = $('.editor-frame');
    this.canvas = $('.editor-canvas');
    this.overlay = $('.editor-overlay');
    this.previewImg = $('.editor-preview');
    this.loupe = $('.loupe');
    this.status = $('.editor-status');
    this.saveButton = $('[data-action="save"]');
    this.previewButton = $('[data-action="preview"]');

    this.polygon.classList.add('quad');
    this.overlay.append(this.polygon);
    for (let i = 0; i < 4; i++) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.classList.add('handle');
      c.setAttribute('r', '14');
      this.handles.push(c);
      this.overlay.append(c);
    }

    this.frame.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.frame.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.frame.addEventListener('pointerup', () => this.endDrag());
    this.frame.addEventListener('pointercancel', () => this.endDrag());

    this.dialog.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action], button[data-filter]');
      if (!button) return;
      if (button.dataset.filter) this.setFilter(button.dataset.filter as PageFilter);
      else void this.onAction(button.dataset.action!);
    });
    // Escape / back gesture.
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.finish(null);
    });
    window.addEventListener('resize', () => {
      if (this.dialog.open) this.layout();
    });
  }

  async open(page: Page): Promise<EditResult | null> {
    this.page = page;
    this.previewing = false;
    this.clearPreview();
    this.status.textContent = 'Loading…';
    this.dialog.showModal();
    this.bitmap = await createImageBitmap(page.original);
    this.edit = page.edit ? structuredClone(page.edit) : await initialEdit(page.original);
    this.status.textContent = '';
    this.layout();
    this.syncControls();
    return new Promise((resolve) => (this.settle = resolve));
  }

  private finish(result: EditResult | null): void {
    this.dialog.close();
    this.bitmap?.close();
    this.bitmap = null;
    this.page = null;
    // Keep the rendered blob (the caller owns it now) but drop our object URL.
    if (this.preview) URL.revokeObjectURL(this.preview.url);
    this.preview = null;
    this.previewImg.removeAttribute('src');
    this.settle?.(result);
    this.settle = null;
  }

  private async onAction(action: string): Promise<void> {
    if (!this.page) return;
    switch (action) {
      case 'cancel':
        this.finish(null);
        return;
      case 'rotate-left':
      case 'rotate-right': {
        const dir = action === 'rotate-right' ? 1 : -1;
        this.edit.rotation = addRotation(this.edit.rotation, 90 * dir);
        this.edit.corners = rotateQuadCW(this.edit.corners, dir);
        this.layout();
        break;
      }
      case 'auto': {
        this.status.textContent = 'Looking for the page…';
        const found = await detectCorners(this.page.original, this.edit.rotation).catch(() => null);
        this.status.textContent = found ? '' : 'Could not find the page edges. Drag the corners instead.';
        if (found) this.edit.corners = insetQuad(found, DETECT_INSET);
        break;
      }
      case 'full':
        this.edit.corners = structuredClone(FULL_QUAD);
        break;
      case 'preview':
        this.previewing = !this.previewing;
        break;
      case 'save':
        await this.save();
        return;
    }
    this.syncControls();
  }

  private setFilter(filter: PageFilter): void {
    this.edit.filter = filter;
    rememberFilter(filter);
    this.syncControls();
  }

  private async save(): Promise<void> {
    if (!this.page || !isConvexQuad(this.edit.corners)) return;
    this.saveButton.disabled = true;
    this.status.textContent = 'Saving…';
    try {
      const key = JSON.stringify(this.edit);
      const image = this.preview?.key === key ? this.preview.blob : await renderPage(this.page.original, this.edit);
      this.finish({ edit: structuredClone(this.edit), image });
    } catch (err) {
      this.status.textContent = `Could not process the page: ${err instanceof Error ? err.message : err}`;
    } finally {
      this.saveButton.disabled = false;
    }
  }

  /** Sizes the photo to fit the stage and redraws it with the current rotation. */
  private layout(): void {
    const bitmap = this.bitmap;
    if (!bitmap) return;
    const turned = this.edit.rotation === 90 || this.edit.rotation === 270;
    const srcW = turned ? bitmap.height : bitmap.width;
    const srcH = turned ? bitmap.width : bitmap.height;
    // Leave room around the photo so corner handles at the edges stay grabbable.
    const pad = 24;
    const availW = Math.max(1, this.stage.clientWidth - pad * 2);
    const availH = Math.max(1, this.stage.clientHeight - pad * 2);
    const scale = Math.min(availW / srcW, availH / srcH);
    const width = Math.round(srcW * scale);
    const height = Math.round(srcH * scale);
    this.displaySize = { width, height };

    this.frame.style.width = `${width}px`;
    this.frame.style.height = `${height}px`;
    this.overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.rotate((this.edit.rotation * Math.PI) / 180);
    const [dw, dh] = turned ? [this.canvas.height, this.canvas.width] : [this.canvas.width, this.canvas.height];
    ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh);
    this.syncControls();
  }

  /** Updates the overlay, buttons and preview to match the current edit. */
  private syncControls(): void {
    const { width, height } = this.displaySize;
    const pts = this.edit.corners.map((p) => ({ x: p.x * width, y: p.y * height }));
    this.polygon.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
    pts.forEach((p, i) => {
      this.handles[i].setAttribute('cx', String(p.x));
      this.handles[i].setAttribute('cy', String(p.y));
    });
    const valid = isConvexQuad(this.edit.corners);
    this.polygon.classList.toggle('invalid', !valid);
    this.saveButton.disabled = !valid;

    for (const b of this.dialog.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
      b.setAttribute('aria-checked', String(b.dataset.filter === this.edit.filter));
    }
    this.previewButton.setAttribute('aria-pressed', String(this.previewing));
    this.canvas.hidden = this.previewing;
    this.overlay.style.display = this.previewing ? 'none' : '';
    this.previewImg.hidden = !this.previewing;
    if (this.previewing) void this.updatePreview();
  }

  private async updatePreview(): Promise<void> {
    if (!this.page || !isConvexQuad(this.edit.corners)) return;
    const key = JSON.stringify(this.edit);
    if (this.preview?.key === key) return;
    const token = ++this.previewToken;
    this.status.textContent = 'Rendering preview…';
    try {
      const blob = await renderPage(this.page.original, this.edit);
      // A newer edit may have started while this one was rendering.
      if (token !== this.previewToken || !this.page) return;
      this.clearPreview();
      this.preview = { key, blob, url: URL.createObjectURL(blob) };
      this.previewImg.src = this.preview.url;
      this.status.textContent = '';
    } catch (err) {
      if (token === this.previewToken) this.status.textContent = `Preview failed: ${err instanceof Error ? err.message : err}`;
    }
  }

  private clearPreview(): void {
    if (this.preview) URL.revokeObjectURL(this.preview.url);
    this.preview = null;
  }

  private toLocal(e: PointerEvent): Point {
    const r = this.frame.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.previewing) return;
    const p = this.toLocal(e);
    const { width, height } = this.displaySize;
    let best = -1;
    let bestDist = GRAB_RADIUS;
    this.edit.corners.forEach((c, i) => {
      const d = Math.hypot(c.x * width - p.x, c.y * height - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best < 0) return;
    e.preventDefault();
    this.dragging = best;
    try {
      this.frame.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events have no capturable pointer.
    }
    this.handles[best].classList.add('active');
    this.moveCorner(p);
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.dragging === null) return;
    e.preventDefault();
    this.moveCorner(this.toLocal(e));
  }

  private moveCorner(p: Point): void {
    const { width, height } = this.displaySize;
    const corner = {
      x: Math.min(Math.max(p.x / width, 0), 1),
      y: Math.min(Math.max(p.y / height, 0), 1),
    };
    this.edit.corners[this.dragging!] = corner;
    this.syncControls();
    this.drawLoupe(corner);
  }

  private endDrag(): void {
    if (this.dragging === null) return;
    this.handles[this.dragging].classList.remove('active');
    this.dragging = null;
    this.loupe.hidden = true;
  }

  /** Magnified view around the dragged corner, since the finger hides it. */
  private drawLoupe(corner: Point): void {
    const loupe = this.loupe;
    const dpr = this.canvas.width / this.displaySize.width;
    const size = Math.round(LOUPE_SIZE * dpr);
    if (loupe.width !== size) loupe.width = loupe.height = size;
    const ctx = loupe.getContext('2d')!;
    const cx = corner.x * this.canvas.width;
    const cy = corner.y * this.canvas.height;
    // Source square, in canvas pixels, that fills the loupe at LOUPE_ZOOM.
    const half = (LOUPE_SIZE / 2 / LOUPE_ZOOM) * dpr;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.canvas, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    // Sit in the top corner away from the finger.
    loupe.classList.toggle('right', corner.x < 0.5);
    loupe.hidden = false;
  }
}
