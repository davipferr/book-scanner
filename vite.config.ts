import { defineConfig } from 'vite';
import { OCR_CORE_PATH, OCR_WORKER_PATH, pwa } from './build/pwa';

export default defineConfig({
  // Relative asset URLs, so the build works under any sub-path (e.g. GitHub Pages /book-scanner/).
  base: './',
  // Expose the dev server on the LAN so a phone can open it.
  server: { host: true },
  define: {
    __OCR_WORKER_PATH__: JSON.stringify(OCR_WORKER_PATH),
    __OCR_CORE_PATH__: JSON.stringify(OCR_CORE_PATH),
  },
  plugins: [pwa()],
});
