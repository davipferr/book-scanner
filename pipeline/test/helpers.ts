import type { FileProbe } from '../scripts/lib/files.ts';
import type { Flow, Step } from '../scripts/lib/flow.ts';

/** Sistema de arquivos em memória: caminho → [conteúdo, mtime]. */
export function memProbe(files: Record<string, string | [string, number]>): FileProbe {
  const entry = (path: string) => files[path];
  return {
    read: (path) => {
      const e = entry(path);
      return e === undefined ? null : Array.isArray(e) ? e[0] : e;
    },
    mtimeMs: (path) => {
      const e = entry(path);
      return e === undefined ? null : Array.isArray(e) ? e[1] : 1;
    },
  };
}

export function step(partial: Partial<Step> & Pick<Step, 'id'>): Step {
  return { title: partial.id, skill: partial.id, source: 'local', inputs: [], outputs: [], interactive: false, ...partial };
}

export function flowOf(...steps: Step[]): Flow {
  return { name: 'teste', description: '', code: 'workspace', steps, helpers: [] };
}

export function skillMd(name: string, body = '', description = `Faz ${name}.`): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
}
