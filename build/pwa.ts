import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

/** Where a package's files are, and its version. */
function pkg(name: string): { dir: string; version: string } {
  const file = require.resolve(`${name}/package.json`);
  return { dir: dirname(file), version: JSON.parse(readFileSync(file, 'utf8')).version };
}

const tesseract = pkg('tesseract.js');
const core = pkg('tesseract.js-core');

/**
 * The text reader is served from this site instead of a CDN so it runs as a same-origin
 * worker the service worker can cache. Paths carry the versions so updates don't mix files.
 * Only the LSTM cores are shipped: the app always runs Tesseract in LSTM-only mode.
 */
export const OCR_FILES: Record<string, string> = {
  [`tesseract/${tesseract.version}/worker.min.js`]: join(tesseract.dir, 'dist/worker.min.js'),
  [`tesseract-core/${core.version}/tesseract-core-simd-lstm.wasm.js`]: join(core.dir, 'tesseract-core-simd-lstm.wasm.js'),
  [`tesseract-core/${core.version}/tesseract-core-lstm.wasm.js`]: join(core.dir, 'tesseract-core-lstm.wasm.js'),
};
export const OCR_WORKER_PATH = `tesseract/${tesseract.version}/worker.min.js`;
export const OCR_CORE_PATH = `tesseract-core/${core.version}/`;

/** Files never worth precaching: source maps. */
const skip = (file: string) => file.endsWith('.map');

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Builds the service worker source from the template. */
export function serviceWorkerSource(template: string, precache: string[], version: string): string {
  return template
    .replace('__VERSION__', JSON.stringify(version))
    .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
    .replace('__OCR_PATHS__', JSON.stringify([`tesseract/${tesseract.version}/`, OCR_CORE_PATH]));
}

/**
 * Offline support: emits sw.js with the list of built files to precache (and a version
 * derived from their contents, so any change installs a new worker), and serves/copies the
 * self-hosted text reader files.
 */
export function pwa(): Plugin {
  let publicDir = '';
  return {
    name: 'book-scanner-pwa',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    // In development, serve the reader files straight from node_modules.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0].replace(/^\//, '') ?? '';
        const file = OCR_FILES[path];
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript');
        createReadStream(file).pipe(res);
      });
    },
    // Runs last, after Vite has emitted index.html, so the page is in the list too.
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const [path, file] of Object.entries(OCR_FILES)) {
          this.emitFile({ type: 'asset', fileName: path, source: readFileSync(file) });
        }

        const hash = createHash('sha256');
        const precache: string[] = [];
        for (const [fileName, out] of Object.entries(bundle)) {
          if (skip(fileName) || fileName in OCR_FILES) continue;
          precache.push(fileName);
          hash.update(fileName).update(out.type === 'chunk' ? out.code : out.source);
        }
        for (const full of publicDir ? listFiles(publicDir) : []) {
          const fileName = relative(publicDir, full).split(sep).join('/');
          if (skip(fileName)) continue;
          precache.push(fileName);
          hash.update(fileName).update(readFileSync(full));
        }
        precache.sort();
        const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
        // A change to the worker's own logic also needs a fresh cache.
        const version = hash.update(template).digest('hex').slice(0, 12);
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(template, precache, version) });
      },
    },
  };
}
