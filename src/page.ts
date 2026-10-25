import type { Quad, Rotation } from './geometry';
import type { PageFilter } from './raster';

/** How to turn the original photo into the clean page; kept so a page can be re-edited. */
export interface PageEdit {
  rotation: Rotation;
  /** Normalized corners (0..1) in the rotated photo. */
  corners: Quad;
  filter: PageFilter;
}

/** A scanned page, as stored in IndexedDB. */
export interface Page {
  id: number;
  bookId: number;
  createdAt: number;
  /** The photo as captured. */
  original: Blob;
  edit: PageEdit | null;
  /** What is shown: the processed page, or the original while unedited. */
  image: Blob;
  /** Text read by OCR (possibly corrected by hand); missing or null until read. */
  text?: string | null;
  /** OCR mean confidence, 0..100. */
  textConfidence?: number | null;
  /** True once the user has corrected the text, so re-cropping doesn't throw it away. */
  textEdited?: boolean;
  /** The reader's own note about this page. */
  note?: string;
}

export type PageText = Pick<Page, 'text' | 'textConfidence' | 'textEdited'>;

export interface Book {
  id: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Page ids in reading order. */
  pageIds: number[];
}

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** A marked passage of a page's text, with an optional note. */
export interface Highlight {
  id: number;
  bookId: number;
  pageId: number;
  /** Range in the page text when it was made; re-anchored by `quote` if the text changes. */
  start: number;
  end: number;
  quote: string;
  color: HighlightColor;
  note: string;
  createdAt: number;
}
