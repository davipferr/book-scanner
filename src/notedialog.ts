import { HIGHLIGHT_COLORS, type HighlightColor } from './page';

export type NoteResult = { action: 'save'; note: string; color: HighlightColor } | { action: 'delete' } | null;

export interface NoteRequest {
  title: string;
  note: string;
  /** Set for a highlight: shows the passage, the colors and a Delete button. */
  highlight?: { quote: string; color: HighlightColor };
}

/** Small dialog to write a note on a page or a highlight (and recolor or delete the highlight). */
export class NoteDialog {
  private readonly title: HTMLElement;
  private readonly quote: HTMLElement;
  private readonly colors: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly deleteButton: HTMLButtonElement;
  private color: HighlightColor = 'yellow';
  private settle: ((r: NoteResult) => void) | null = null;

  constructor(private readonly dialog: HTMLDialogElement) {
    const $ = <T extends Element>(ref: string) => dialog.querySelector(`[data-ref="${ref}"]`) as T;
    this.title = $('title');
    this.quote = $('quote');
    this.colors = $('colors');
    this.textarea = $('note');
    this.deleteButton = dialog.querySelector('[data-action="delete"]')!;

    this.colors.replaceChildren(
      ...HIGHLIGHT_COLORS.map((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `swatch hl-${c}`;
        b.dataset.color = c;
        b.setAttribute('aria-label', c);
        b.addEventListener('click', () => this.setColor(c));
        return b;
      }),
    );
    dialog.querySelector('[data-action="save"]')!.addEventListener('click', () =>
      this.finish({ action: 'save', note: this.textarea.value.trim(), color: this.color }),
    );
    dialog.querySelector('[data-action="cancel"]')!.addEventListener('click', () => this.finish(null));
    this.deleteButton.addEventListener('click', () => this.finish({ action: 'delete' }));
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.finish(null);
    });
  }

  open(req: NoteRequest): Promise<NoteResult> {
    this.title.textContent = req.title;
    this.textarea.value = req.note;
    this.quote.hidden = this.colors.hidden = this.deleteButton.hidden = !req.highlight;
    if (req.highlight) {
      this.quote.textContent = req.highlight.quote;
      this.setColor(req.highlight.color);
    }
    this.dialog.showModal();
    // A page note is mostly about the text; for a highlight the passage is the point.
    if (!req.highlight) this.textarea.focus();
    return new Promise((resolve) => (this.settle = resolve));
  }

  private setColor(c: HighlightColor): void {
    this.color = c;
    this.quote.className = `note-quote hl-${c}`;
    for (const b of this.colors.querySelectorAll<HTMLButtonElement>('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.color === c));
    }
  }

  private finish(result: NoteResult): void {
    this.dialog.close();
    this.settle?.(result);
    this.settle = null;
  }
}
