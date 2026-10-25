import { bookText, fileName, type TextFormat } from './export';
import type { Book, Highlight, Page } from './page';
import { buildPdf } from './pdf';
import { shrinkImage } from './processing';

type Format = 'pdf' | TextFormat;

/** Settings for the "Smaller file" PDF option: enough to read comfortably on a phone. */
const SMALL_SIDE = 1600;
const SMALL_QUALITY = 0.7;

/** Full-screen sheet to export a book as a PDF of its pages, or its text as .txt / .md. */
export class ExportPanel {
  private readonly form: HTMLFormElement;
  private readonly from: HTMLInputElement;
  private readonly to: HTMLInputElement;
  private readonly summary: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progressBar: HTMLProgressElement;
  private readonly downloadButton: HTMLButtonElement;
  private readonly shareButton: HTMLButtonElement;

  private book: Book | null = null;
  private pages: Page[] = [];
  private highlights: Highlight[] = [];
  private busy = false;

  constructor(private readonly dialog: HTMLDialogElement) {
    const $ = <T extends Element>(ref: string) => dialog.querySelector(`[data-ref="${ref}"]`) as T;
    this.form = $('form');
    this.from = $('from');
    this.to = $('to');
    this.summary = $('summary');
    this.status = $('status');
    this.progressBar = $('progress');
    this.downloadButton = dialog.querySelector('[data-action="download"]')!;
    this.shareButton = dialog.querySelector('[data-action="share"]')!;

    dialog.querySelector('[data-action="close"]')!.addEventListener('click', () => dialog.close());
    this.form.addEventListener('input', () => this.render());
    this.form.addEventListener('submit', (e) => e.preventDefault());
    this.downloadButton.addEventListener('click', () => void this.run('download'));
    this.shareButton.addEventListener('click', () => void this.run('share'));
    // Typing a range shouldn't leave it inverted or outside the book.
    for (const input of [this.from, this.to]) input.addEventListener('change', () => this.clampRange());
  }

  open(book: Book, pages: Page[], highlights: Highlight[]): void {
    this.book = book;
    this.pages = pages;
    this.highlights = highlights;
    this.from.max = this.to.max = String(Math.max(pages.length, 1));
    this.from.value = '1';
    this.to.value = String(pages.length);
    this.status.textContent = '';
    this.progressBar.hidden = true;
    this.render();
    this.dialog.showModal();
  }

  private get format(): Format {
    return new FormData(this.form).get('format') as Format;
  }

  private get range(): { start: number; end: number } {
    if (new FormData(this.form).get('range') === 'all') return { start: 1, end: this.pages.length };
    return { start: Number(this.from.value) || 1, end: Number(this.to.value) || this.pages.length };
  }

  private clampRange(): void {
    const n = this.pages.length;
    const clamp = (v: number) => Math.min(Math.max(Math.round(v) || 1, 1), n);
    const start = clamp(Number(this.from.value));
    const end = Math.max(start, clamp(Number(this.to.value)));
    this.from.value = String(start);
    this.to.value = String(end);
    this.render();
  }

  private selected(): Page[] {
    const { start, end } = this.range;
    return this.pages.slice(start - 1, end);
  }

  private render(): void {
    const format = this.format;
    const fd = new FormData(this.form);
    this.dialog.querySelectorAll<HTMLElement>('[data-for]').forEach((el) => {
      el.hidden = !el.dataset.for!.split(' ').includes(format);
    });
    const custom = fd.get('range') === 'custom';
    this.from.disabled = this.to.disabled = !custom;

    const pages = this.selected();
    const withText = pages.filter((p) => p.text?.trim() || p.note?.trim()).length;
    this.summary.textContent =
      format === 'pdf'
        ? `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`
        : `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}, ${withText} with text` +
          (withText < pages.length ? '. Use “Read all text” first to include the rest.' : '');

    const empty = pages.length === 0 || (format !== 'pdf' && withText === 0);
    this.downloadButton.disabled = this.busy || empty;
    this.shareButton.disabled = this.busy || empty;
    this.shareButton.hidden = !('canShare' in navigator);
  }

  private async build(): Promise<File> {
    const book = this.book!;
    const pages = this.selected();
    const format = this.format;
    if (format !== 'pdf') {
      const fd = new FormData(this.form);
      const exportPages = pages.map((p) => ({
        text: p.text,
        note: p.note,
        highlights: this.highlights
          .filter((h) => h.pageId === p.id)
          // Reading order; a quote's position is good enough here.
          .sort((a, b) => a.start - b.start),
      }));
      const text = bookText(exportPages, {
        title: book.title,
        format,
        pageNumbers: fd.get('page-numbers') === 'on',
        firstPage: this.range.start,
        annotations: fd.get('annotations') === 'on',
      });
      const type = format === 'md' ? 'text/markdown' : 'text/plain';
      return new File([text], fileName(book.title, format), { type: `${type};charset=utf-8` });
    }

    const small = new FormData(this.form).get('quality') === 'small';
    const images: Blob[] = [];
    this.progressBar.hidden = false;
    for (const [i, page] of pages.entries()) {
      this.status.textContent = small ? `Preparing page ${i + 1} of ${pages.length}…` : 'Building the PDF…';
      this.progressBar.value = i / pages.length;
      images.push(small ? await shrinkImage(page.image, SMALL_SIDE, SMALL_QUALITY) : page.image);
    }
    this.status.textContent = 'Building the PDF…';
    const pdf = await buildPdf(images, { title: book.title });
    return new File([pdf], fileName(book.title, 'pdf'), { type: 'application/pdf' });
  }

  private async run(action: 'download' | 'share'): Promise<void> {
    if (this.busy || !this.book) return;
    this.busy = true;
    this.render();
    try {
      const file = await this.build();
      const size = file.size > 1e6 ? `${(file.size / 1e6).toFixed(1)} MB` : `${Math.ceil(file.size / 1e3)} KB`;
      if (action === 'share' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: this.book.title });
          this.status.textContent = `Shared ${file.name} (${size}).`;
        } catch (err) {
          // Closing the share sheet is not an error.
          if (err instanceof DOMException && err.name === 'AbortError') this.status.textContent = '';
          else throw err;
        }
      } else {
        download(file);
        this.status.textContent = `Saved ${file.name} (${size}).`;
      }
    } catch (err) {
      this.status.textContent = `Export failed: ${err instanceof Error ? err.message : err}`;
    } finally {
      this.busy = false;
      this.progressBar.hidden = true;
      this.render();
    }
  }
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser time to start reading the file before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
