import { OCR_LANGUAGES, ocrLanguage, setOcrLanguage, type OcrLanguage, type OcrProgress } from './ocr';
import type { Page } from './page';

/** Confidence below which the reader is nudged to check the page. */
const LOW_CONFIDENCE = 60;
const SAVE_DELAY_MS = 600;

export interface TextPanelActions {
  /** Runs OCR on the page and stores the result. */
  read(page: Page, progress: (p: OcrProgress) => void): Promise<Page>;
  /** Stores text the user typed. */
  save(page: Page, text: string): Promise<Page>;
}

/** Fills a <select> with the OCR languages and keeps it in sync with the saved choice. */
export function bindLanguageSelect(select: HTMLSelectElement): void {
  select.replaceChildren(
    ...Object.entries(OCR_LANGUAGES).map(([value, label]) => new Option(label, value)),
  );
  select.value = ocrLanguage();
  select.addEventListener('change', () => setOcrLanguage(select.value as OcrLanguage));
  // Another select may have changed it.
  select.addEventListener('focus', () => (select.value = ocrLanguage()));
}

/** Full-screen sheet showing a page's text: read it with OCR, correct it, copy it. */
export class TextPanel {
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progressBar: HTMLProgressElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly language: HTMLSelectElement;
  private readonly readButton: HTMLButtonElement;
  private readonly copyButton: HTMLButtonElement;

  private page: Page | null = null;
  private reading = false;
  private saveTimer: number | undefined;
  private pendingSave: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly actions: TextPanelActions,
  ) {
    const $ = <T extends Element>(ref: string) => dialog.querySelector(`[data-ref="${ref}"]`) as T;
    this.title = $('title');
    this.status = $('status');
    this.progressBar = $('progress');
    this.textarea = $('text');
    this.language = $('language');
    this.readButton = dialog.querySelector('[data-action="read"]')!;
    this.copyButton = dialog.querySelector('[data-action="copy"]')!;
    bindLanguageSelect(this.language);

    dialog.querySelector('[data-action="close"]')!.addEventListener('click', () => dialog.close());
    this.readButton.addEventListener('click', () => void this.read());
    this.copyButton.addEventListener('click', () => void this.copy());
    this.textarea.addEventListener('input', () => {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => this.flush(), SAVE_DELAY_MS);
    });
    dialog.addEventListener('close', () => {
      this.flush();
      this.page = null;
    });
  }

  open(page: Page, label: string): void {
    this.page = page;
    this.title.textContent = label;
    this.textarea.value = page.text ?? '';
    this.language.value = ocrLanguage();
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Saves typed text now instead of waiting for the debounce. */
  private flush(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const page = this.page;
    if (!page || this.reading) return;
    const text = this.textarea.value;
    if (text === (page.text ?? '')) return;
    this.pendingSave = this.pendingSave
      .then(() => this.actions.save(page, text))
      .then((saved) => {
        if (this.page?.id === saved.id) {
          this.page = saved;
          this.render();
        }
      })
      .catch((err) => (this.status.textContent = `Could not save: ${err instanceof Error ? err.message : err}`));
  }

  private async read(): Promise<void> {
    const page = this.page;
    if (!page || this.reading) return;
    if (page.textEdited && !confirm('Reading again replaces the text you corrected. Continue?')) return;
    this.flush();
    await this.pendingSave;
    this.reading = true;
    this.render();
    try {
      const updated = await this.actions.read(page, (p) => {
        this.status.textContent = p.stage;
        this.progressBar.value = p.progress;
      });
      if (this.page?.id === updated.id) {
        this.page = updated;
        this.textarea.value = updated.text ?? '';
      }
    } catch (err) {
      this.status.textContent = `Could not read the text: ${err instanceof Error ? err.message : err}`;
      this.reading = false;
      this.renderControls();
      return;
    }
    this.reading = false;
    this.render();
  }

  private async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.textarea.value);
      this.copyButton.textContent = 'Copied';
    } catch {
      // Clipboard API blocked: select the text so the user can copy it by hand.
      this.textarea.select();
      this.copyButton.textContent = 'Select & copy';
    }
    window.setTimeout(() => (this.copyButton.textContent = 'Copy'), 1500);
  }

  private render(): void {
    const page = this.page;
    if (!page) return;
    if (this.reading) this.status.textContent = 'Starting…';
    else if (page.text == null) this.status.textContent = 'Not read yet. Tap “Read text” to get this page’s text.';
    else {
      const conf = page.textConfidence;
      const parts = [conf != null ? `Read with ${conf}% confidence` : 'Text'];
      if (page.textEdited) parts.push('corrected by you');
      if (conf != null && conf < LOW_CONFIDENCE && !page.textEdited) {
        parts.push('low: check that the page is cleaned, sharp and in the right language');
      }
      this.status.textContent = parts.join(' · ');
    }
    this.renderControls();
  }

  private renderControls(): void {
    const page = this.page;
    this.progressBar.hidden = !this.reading;
    if (this.reading) this.progressBar.removeAttribute('value');
    this.readButton.disabled = this.reading;
    this.language.disabled = this.reading;
    this.textarea.readOnly = this.reading;
    this.readButton.textContent = this.reading ? 'Reading…' : page?.text == null ? 'Read text' : 'Read again';
    this.textarea.placeholder = page?.text == null ? '' : 'No text found on this page.';
  }
}
