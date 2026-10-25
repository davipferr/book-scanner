import { WORKSPACE_DIR, type FileProbe } from './files.ts';
import type { Flow } from './flow.ts';

/**
 * O mapa de funcionalidades de um projeto que já existia antes do pipeline. Produto
 * (fica fora de pipeline/ e de docs/flow/, então o archive não o move): a skill
 * `onboard` o escreve uma vez, e a etapa de implementação o mantém em dia.
 */
export const PROJECT_MAP = 'docs/FEATURE-MAP.md';
export const ONBOARD_SKILL = 'onboard';

/** Seções que o mapa precisa ter. "Skills do projeto" é onde a onboard registra o que achou com a find-skills. */
export const PROJECT_MAP_SECTIONS = ['## Instalar e rodar', '## Funcionalidades', '## Skills do projeto'];

/**
 * O que falta para o projeto estar pronto para a primeira execução. Só vale quando
 * o código já existia (`code` fora de `workspace`): num projeto novo, o código e o
 * mapa nascem na própria execução (o mapa é uma seção do 05-implementacao.md).
 */
export function onboardProblems(flow: Flow, probe: FileProbe): string[] {
  if (flow.code === WORKSPACE_DIR) return [];
  const map = probe.read(PROJECT_MAP);
  if (map === null) return [`falta o ${PROJECT_MAP}, o mapa do código que já existia`];
  const problems = PROJECT_MAP_SECTIONS.filter((s) => !new RegExp(`^${s}\\s*$`, 'm').test(map)).map((s) => `${PROJECT_MAP} sem a seção "${s}"`);
  if (problems.length === 0 && !hasTableRow(section(map, '## Funcionalidades'))) {
    problems.push(`${PROJECT_MAP}: a tabela de "## Funcionalidades" não tem nenhuma linha`);
  }
  return problems;
}

/** O texto entre o título `heading` e o próximo título do mesmo nível. */
function section(text: string, heading: string): string {
  const start = text.search(new RegExp(`^${heading}\\s*$`, 'm'));
  if (start === -1) return '';
  const rest = text.slice(start + heading.length);
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Há uma tabela com cabeçalho, separador e pelo menos uma linha de dados. */
function hasTableRow(text: string): boolean {
  const rows = text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  return rows.length >= 3 && rows.slice(2).some((r) => r.replace(/[|\s-]/g, '') !== '');
}
