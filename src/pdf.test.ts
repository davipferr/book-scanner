import { describe, expect, it } from 'vitest';
import { buildPdf, jpegInfo } from './pdf';

/** A JPEG-shaped byte sequence: SOI, an APP0 segment, then SOF0 with the given size. */
function fakeJpeg(width: number, height: number, components = 3, payload = 50): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 8, height >> 8, height & 255, width >> 8, width & 255, components];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...new Array(payload).fill(0x42), 0xff, 0xd9]);
}

describe('jpegInfo', () => {
  it('reads size and components after other segments', () => {
    expect(jpegInfo(fakeJpeg(1441, 1831))).toEqual({ width: 1441, height: 1831, components: 3 });
    expect(jpegInfo(fakeJpeg(10, 20, 1)).components).toBe(1);
  });

  it('rejects non-JPEG data', () => {
    expect(() => jpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow();
  });
});

describe('buildPdf', () => {
  it('writes a structurally valid PDF with one page per image', async () => {
    const images = [fakeJpeg(1000, 1500), fakeJpeg(800, 600, 1)].map(
      (b) => new Blob([b as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
    );
    const pdf = await buildPdf(images, { title: 'Dom Casmurro – Machado', date: new Date(Date.UTC(2026, 9, 25)) });
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    // Latin-1 keeps one char per byte so string offsets equal byte offsets.
    const text = Array.from(bytes, (b) => String.fromCharCode(b)).join('');

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/MediaBox [0 0 595.28 892.92]');
    expect(text).toContain('/DeviceGray');
    expect(text).toContain('/CreationDate (D:20261025000000Z)');

    // startxref points at the xref table, and every entry points at its "N 0 obj".
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = text.slice(startxref).split('\n').slice(3, 3 + 9);
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });

    // Image streams hold the JPEG bytes unchanged.
    const stream = text.indexOf('stream\n', text.indexOf('/Subtype /Image')) + 'stream\n'.length;
    expect(bytes[stream]).toBe(0xff);
    expect(bytes[stream + 1]).toBe(0xd8);
  });
});
