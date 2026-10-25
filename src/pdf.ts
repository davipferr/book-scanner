/**
 * A minimal PDF writer: one JPEG per page, embedded as-is (DCTDecode), so nothing is
 * re-encoded and the file is built from Blob slices without copying the photos into memory.
 */

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
}

/** Reads the size and channel count from a JPEG's start-of-frame marker. */
export function jpegInfo(bytes: Uint8Array): JpegInfo {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG image.');
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    // Fill bytes and markers without a length.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    // SOF0..SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9],
      };
    }
    i += 2 + length;
  }
  throw new Error('JPEG size not found.');
}

/** How many leading bytes to search for the frame header; EXIF thumbnails can be large. */
const HEADER_BYTES = 256 * 1024;

export interface PdfOptions {
  title: string;
  /** Page width in points; height follows each image's aspect ratio. A4 width by default. */
  pageWidth?: number;
  /** For reproducible output in tests. */
  date?: Date;
}

/** Encodes a string as a PDF text string in UTF-16BE, so accents survive in metadata. */
function pdfText(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex.toUpperCase()}>`;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `(D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z)`;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export async function buildPdf(images: Blob[], options: PdfOptions): Promise<Blob> {
  const pageWidth = options.pageWidth ?? 595.28;
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let size = 0;

  const write = (part: string | Blob) => {
    if (typeof part === 'string') {
      const bytes = encoder.encode(part);
      parts.push(bytes);
      size += bytes.length;
    } else {
      parts.push(part);
      size += part.size;
    }
  };
  const object = (id: number, body: string) => {
    offsets[id] = size;
    write(`${id} 0 obj\n${body}\nendobj\n`);
  };

  // The binary comment tells tools the file contains binary data.
  write('%PDF-1.4\n%âãÏÓ\n');

  // Objects: 1 catalog, 2 page tree, 3 info, then 3 per page (page, image, content).
  const pageId = (i: number) => 4 + i * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${images.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${images.length} >>`);
  object(
    3,
    `<< /Title ${pdfText(options.title)} /Producer (Book Scanner) /CreationDate ${pdfDate(options.date ?? new Date())} >>`,
  );

  for (const [i, image] of images.entries()) {
    const info = jpegInfo(new Uint8Array(await image.slice(0, HEADER_BYTES).arrayBuffer()));
    const colorSpace = info.components === 1 ? '/DeviceGray' : info.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
    const w = pageWidth;
    const h = (pageWidth * info.height) / info.width;
    const id = pageId(i);
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(w)} ${fmt(h)}] ` +
        `/Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    offsets[id + 1] = size;
    write(
      `${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} ` +
        `/ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.size} >>\nstream\n`,
    );
    write(image);
    write('\nendstream\nendobj\n');
    // Draw the image scaled to fill the page.
    const content = `q ${fmt(w)} 0 0 ${fmt(h)} 0 0 cm /Im0 Do Q`;
    object(id + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  const count = 4 + images.length * 3;
  const xref = size;
  // Each xref entry is exactly 20 bytes.
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  write(table);
  write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts, { type: 'application/pdf' });
}
