import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/**
 * O projeto base inteiro mora nesta pasta. Fora dela, na raiz do repositório,
 * só ficam os produtos das execuções (docs/flow/, docs/runs/, workspace/) e o
 * que cada agente procura na raiz (AGENTS.md, CLAUDE.md, .claude/, .agents/).
 */
export const PIPELINE_DIR = 'pipeline';

/** Produtos de uma execução: o pipeline grava aqui, nunca dentro de pipeline/. */
export const FLOW_DIR = 'docs/flow';
export const RUNS_DIR = 'docs/runs';
export const WORKSPACE_DIR = 'workspace';

/** Raiz do repositório (a pasta acima de pipeline/), de onde quer que o comando rode. */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Caminho que o usuário digitou, a partir da pasta onde ele rodou o comando.
 * `npm --prefix pipeline run ...` roda dentro de pipeline/, mas guarda a pasta original em INIT_CWD.
 */
export function userPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

/**
 * O pouco de sistema de arquivos que a lógica do pipeline precisa.
 * Os testes passam uma versão em memória; os scripts usam `diskProbe`.
 */
export interface FileProbe {
  /** Conteúdo do arquivo (caminho relativo à raiz do projeto) ou `null` se não existir. */
  read(path: string): string | null;
  /** Data de modificação em ms, ou `null` se não existir. */
  mtimeMs(path: string): number | null;
}

export function diskProbe(root: string): FileProbe {
  return {
    read(path) {
      try {
        return readFileSync(join(root, path), 'utf8');
      } catch {
        return null;
      }
    },
    mtimeMs(path) {
      try {
        return statSync(join(root, path)).mtimeMs;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Faz os caminhos `<prefix>...` do flow.yaml serem procurados na raiz da pasta.
 * É o formato do `npm --prefix pipeline run archive`, que guarda `docs/flow/01-ideia.md` como
 * `docs/runs/<execução>/01-ideia.md`.
 */
export function flattenProbe(probe: FileProbe, prefix: string): FileProbe {
  const strip = (path: string) => (path.startsWith(prefix) ? path.slice(prefix.length) : path);
  return {
    read: (path) => probe.read(strip(path)),
    mtimeMs: (path) => probe.mtimeMs(strip(path)),
  };
}

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Separa o cabeçalho YAML (`---` ... `---`) do corpo de um Markdown. */
export function parseFrontmatter(text: string): Frontmatter | null {
  const match = FRONTMATTER.exec(text);
  if (!match) return null;
  const data: unknown = parse(match[1] ?? '');
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  return { data: data as Record<string, unknown>, body: text.slice(match[0].length) };
}

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export const error = (where: string, message: string): Issue => ({ level: 'error', where, message });
export const warning = (where: string, message: string): Issue => ({ level: 'warning', where, message });
