import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OCR_CORE_PATH, OCR_FILES, OCR_WORKER_PATH, serviceWorkerSource } from './pwa';

const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');

describe('serviceWorkerSource', () => {
  const source = serviceWorkerSource(template, ['index.html', 'assets/index-abc.js'], 'v123');

  it('fills every placeholder', () => {
    expect(source).not.toMatch(/__[A-Z_]+__/);
    expect(source).toContain('const VERSION = "v123"');
    expect(source).toContain('"assets/index-abc.js"');
    expect(source).toContain(JSON.stringify(OCR_CORE_PATH));
  });

  it('is valid JavaScript', () => {
    expect(() => new Function(source)).not.toThrow();
  });
});

describe('OCR files', () => {
  it('ship the worker and both LSTM cores from versioned paths', () => {
    expect(Object.keys(OCR_FILES)).toContain(OCR_WORKER_PATH);
    expect(Object.keys(OCR_FILES).filter((p) => p.startsWith(OCR_CORE_PATH))).toHaveLength(2);
    for (const file of Object.values(OCR_FILES)) expect(readFileSync(file).length).toBeGreaterThan(1000);
  });
});
