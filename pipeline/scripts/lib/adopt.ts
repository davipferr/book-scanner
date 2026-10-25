import type { ExternalSource } from './skills.ts';

/** Marcadores do trecho do AGENTS.md e do CLAUDE.md que pertence ao pipeline. */
export const BLOCK_START = '<!-- pipeline:start -->';
export const BLOCK_END = '<!-- pipeline:end -->';

/**
 * Arquivos de pipeline/ que são do projeto, não do template: o adopt nunca os
 * copia daqui e, numa atualização, nunca os apaga nem sobrescreve lá.
 */
export const PROJECT_OWNED = ['flow.yaml', 'skills.json', 'skills-lock.json', 'endurecimento.md'];
/** Pastas de pipeline/ em que cada subpasta é uma skill ou um caso: as que só existem no projeto ficam. */
export const PROJECT_EXTENSIBLE = ['skills', 'evals'];
/** Nunca é copiado nem apagado. */
const IGNORED = ['node_modules'];

/** As linhas que o projeto precisa ter no .gitignore. */
export const GITIGNORE_LINES = ['.claude/skills/', '.agents/skills/', 'pipeline/node_modules/'];

/** O trecho entre os marcadores (com eles), ou `null` se não houver. */
export function extractBlock(text: string): string | null {
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END, start);
  if (start === -1 || end === -1) return null;
  return text.slice(start, end + BLOCK_END.length);
}

/** Troca o trecho do pipeline pelo novo, ou o acrescenta no fim, sem mexer no resto. */
export function upsertBlock(text: string, block: string): string {
  const current = extractBlock(text);
  if (current !== null) return text.replace(current, block);
  return text.trim() === '' ? `${block}\n` : `${text.trimEnd()}\n\n${block}\n`;
}

/** O CLAUDE.md precisa começar importando o AGENTS.md, onde estão as regras do pipeline. */
export function withAgentsImport(text: string): string {
  if (/^@AGENTS\.md\s*$/m.test(text)) return text;
  return `@AGENTS.md\n\n${text.trimStart()}`;
}

/** Linhas de `wanted` que ainda não estão no .gitignore. */
export function missingLines(gitignore: string, wanted: string[]): string[] {
  const have = new Set(gitignore.split(/\r?\n/).map((l) => l.trim().replace(/^\//, '')));
  return wanted.filter((line) => !have.has(line) && !have.has(line.replace(/\/$/, '')));
}

/** Troca só a linha `code:` do flow.yaml, para manter os comentários. */
export function setCode(flowYaml: string, code: string): string {
  if (!/^code:.*$/m.test(flowYaml)) return `${flowYaml.trimEnd()}\n\ncode: ${code}\n`;
  return flowYaml.replace(/^code:.*$/m, `code: ${code}`);
}

/**
 * As skills do skills.sh que o projeto já tinha (o skills-lock.json da raiz, gravado
 * pelo CLI `skills`), no formato do `external` do pipeline/skills.json. Sem isso o
 * `setup` trocaria o lock do projeto pelo do pipeline e elas sumiriam da reinstalação.
 */
export function externalFromLock(lockText: string): ExternalSource[] {
  let lock: unknown;
  try {
    lock = JSON.parse(lockText);
  } catch {
    return [];
  }
  const skills = (lock as { skills?: Record<string, { source?: unknown; sourceType?: unknown }> }).skills ?? {};
  const bySource = new Map<string, string[]>();
  for (const [name, entry] of Object.entries(skills)) {
    if (entry.sourceType !== 'github' || typeof entry.source !== 'string') continue;
    bySource.set(entry.source, [...(bySource.get(entry.source) ?? []), name]);
  }
  return [...bySource].map(([source, names]) => ({ source, skills: names.sort() }));
}

export interface ManifestEntry extends ExternalSource {
  why?: string;
}

/** Junta `extra` ao `external` do skills.json sem repetir skill nem fonte. Devolve as que entraram. */
export function mergeExternal(external: ManifestEntry[], extra: ManifestEntry[]): { external: ManifestEntry[]; added: string[] } {
  const result = external.map((e) => ({ ...e, skills: [...e.skills] }));
  const added: string[] = [];
  for (const entry of extra) {
    const same = result.find((e) => e.source === entry.source);
    const fresh = entry.skills.filter((s) => !same?.skills.includes(s));
    if (fresh.length === 0) continue;
    if (same) same.skills.push(...fresh);
    else result.push({ ...entry, skills: fresh });
    added.push(...fresh.map((s) => `${entry.source}/${s}`));
  }
  return { external: result, added };
}

/**
 * `true` se o arquivo de pipeline/ (caminho relativo a ela) é do projeto: o template
 * não o traz e uma atualização não o apaga. Uma skill ou um caso de eval é do
 * projeto quando a pasta dele não existe no template.
 */
export function isProjectOwned(path: string, templateFiles: string[]): boolean {
  const parts = path.split('/');
  const [top = '', sub] = parts;
  if (IGNORED.includes(top) || PROJECT_OWNED.includes(path)) return true;
  if (PROJECT_EXTENSIBLE.includes(top) && parts.length > 2) return !templateFiles.some((f) => f.startsWith(`${top}/${sub}/`));
  return false;
}

export interface CopyPlan {
  /** Arquivos do template a copiar (caminhos relativos a pipeline/). */
  copy: string[];
  /** Arquivos que o projeto tem em pipeline/ e que saíram do template (só numa atualização). */
  remove: string[];
}

export function copyPlan(templateFiles: string[], targetFiles: string[]): CopyPlan {
  const copy = templateFiles.filter((f) => !IGNORED.includes(f.split('/')[0] ?? '') && !PROJECT_OWNED.includes(f));
  const keep = new Set(copy);
  return { copy, remove: targetFiles.filter((f) => !keep.has(f) && !isProjectOwned(f, templateFiles)) };
}
