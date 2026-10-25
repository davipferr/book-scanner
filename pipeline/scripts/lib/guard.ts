import { PIPELINE_DIR, type FileProbe } from './files.ts';
import type { Flow } from './flow.ts';

/**
 * O que define o pipeline e as regras duras dele: não pode mudar no meio de uma
 * execução. A pasta pipeline/ inteira (skills, scripts, testes, hook, package.json)
 * e as instruções que os agentes leem na raiz. Como tudo do pipeline mora em
 * pipeline/, o código do projeto (o produto) nunca cai nesta lista.
 */
export const PIPELINE_PATHS = [PIPELINE_DIR, 'AGENTS.md', 'CLAUDE.md'];

/** Há uma execução em andamento quando algum artefato do flow.yaml já existe. */
export function activeRun(flow: Flow, probe: FileProbe): boolean {
  return flow.steps.some((step) => step.outputs.some((out) => probe.mtimeMs(out) !== null));
}

/**
 * Lê a saída de `git status --porcelain` e devolve os arquivos com mudanças que
 * o dono ainda não aprovou: alterados e não adicionados ao índice (`git add`), ou novos.
 */
export function unapprovedEdits(porcelain: string): string[] {
  return porcelain
    .split(/\r?\n/)
    .filter((line) => line.length > 3)
    .filter((line) => line[1] !== ' ')
    .map((line) => line.slice(3).replace(/^"|"$/g, ''));
}
