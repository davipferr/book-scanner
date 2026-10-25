import { error, FLOW_DIR, PIPELINE_DIR, RUNS_DIR, warning, type FileProbe, type Issue } from './files.ts';
import { FLOW_FILE, KEBAB, type Flow } from './flow.ts';
import {
  LOCAL_SKILLS_DIR,
  MANIFEST_FILE,
  ORCHESTRATOR,
  checkSkill,
  readInstalled,
  readLocalSkill,
  type LocalSkill,
  type Manifest,
} from './skills.ts';
import { ONBOARD_SKILL, onboardProblems, PROJECT_MAP } from './onboard.ts';

export const AGENTS_FILE = 'AGENTS.md';
/** Marcador do trecho do AGENTS.md que pertence ao pipeline (o que se copia para outro repositório). */
export const AGENTS_BLOCK = '<!-- pipeline:start -->';

/**
 * Confere se o fluxo "fecha": cada etapa tem uma skill que existe, cada entrada
 * é produzida por uma etapa anterior, cada saída tem um único dono.
 * Erros impedem o pipeline de rodar; avisos são coisas que vão dar problema depois.
 */
export function validateProject(flow: Flow, manifest: Manifest, localDirs: string[], probe: FileProbe): Issue[] {
  const issues: Issue[] = [];

  // 1. Todas as skills locais seguem o padrão, usadas ou não.
  const local = new Map<string, LocalSkill>();
  for (const dir of localDirs) {
    const skill = readLocalSkill(probe, dir);
    if (skill === null) {
      issues.push(error(`${LOCAL_SKILLS_DIR}/${dir}`, 'pasta sem SKILL.md'));
      continue;
    }
    issues.push(...checkSkill(skill));
    local.set(dir, skill);
  }

  // Base × produto: o código do projeto nunca fica dentro do pipeline nem dos artefatos.
  const inside = (dir: string, parent: string) => dir === parent || dir.startsWith(`${parent}/`);
  if (inside(flow.code, PIPELINE_DIR) || inside(flow.code, FLOW_DIR) || inside(flow.code, RUNS_DIR)) {
    issues.push(error(`${FLOW_FILE} › code`, `\`code: ${flow.code}\` não pode ficar em ${PIPELINE_DIR}/, ${FLOW_DIR}/ nem ${RUNS_DIR}/: o código é do projeto`));
  }

  // Os agentes só descobrem o pipeline pelo AGENTS.md da raiz.
  if (!(probe.read(AGENTS_FILE) ?? '').includes(AGENTS_BLOCK)) {
    issues.push(warning(AGENTS_FILE, `falta o bloco do pipeline (${AGENTS_BLOCK} ... end): sem ele os agentes não sabem que existe o run-pipeline`));
  }

  // Projeto que já existia: o código precisa de um mapa antes da primeira execução.
  for (const problem of onboardProblems(flow, probe)) {
    issues.push(error(PROJECT_MAP, `${problem}. Peça ao agente a skill ${ONBOARD_SKILL} ("faça o onboard do pipeline")`));
  }

  // 2. Regras de cada etapa, na ordem.
  const ids = new Set<string>();
  const produced = new Map<string, string>(); // arquivo → etapa que já o produziu
  const allOutputs = new Map<string, string>();
  for (const step of flow.steps) for (const out of step.outputs) if (!allOutputs.has(out)) allOutputs.set(out, step.id);

  for (const step of flow.steps) {
    const where = `${FLOW_FILE} › ${step.id}`;

    if (!KEBAB.test(step.id)) issues.push(error(where, 'o `id` deve ser minúsculo-com-hifens'));
    if (ids.has(step.id)) issues.push(error(where, 'há outra etapa com o mesmo `id`'));
    ids.add(step.id);

    if (step.outputs.length === 0) issues.push(error(where, 'a etapa não produz nenhum arquivo: a próxima não terá o que ler'));

    for (const input of step.inputs) {
      if (produced.has(input)) continue;
      const later = allOutputs.get(input);
      issues.push(
        error(
          where,
          later
            ? `lê \`${input}\`, mas quem o produz (${later}) vem depois. Mude a ordem das etapas.`
            : `lê \`${input}\`, que nenhuma etapa produz`,
        ),
      );
    }

    // Base × produto: os artefatos são produto da execução (docs/flow/); o que
    // explica como fazer o trabalho (adapter) é base (pipeline/).
    for (const output of step.outputs) {
      if (!output.startsWith(`${FLOW_DIR}/`)) {
        issues.push(error(where, `a saída \`${output}\` precisa ficar em ${FLOW_DIR}/: artefato é produto da execução, não parte do pipeline`));
      }
    }
    if (step.adapter !== undefined && !step.adapter.startsWith(`${PIPELINE_DIR}/`)) {
      issues.push(error(where, `o adapter \`${step.adapter}\` precisa ficar em ${PIPELINE_DIR}/: ele é parte do pipeline`));
    }

    for (const output of step.outputs) {
      const owner = produced.get(output);
      if (owner) issues.push(error(where, `\`${output}\` já é saída de ${owner}: cada arquivo tem um único dono`));
      else produced.set(output, step.id);
    }

    // `ids` ainda não tem as etapas seguintes: on_reject só pode voltar no fluxo.
    if (step.onReject !== undefined && (step.onReject === step.id || !ids.has(step.onReject))) {
      issues.push(error(where, `\`on_reject: ${step.onReject}\` precisa ser o id de uma etapa anterior`));
    }

    if (step.adapter !== undefined && probe.read(step.adapter) === null) {
      issues.push(error(where, `o adapter \`${step.adapter}\` não existe`));
    }

    if (step.source === 'local') {
      const skill = local.get(step.skill);
      if (!skill) {
        issues.push(error(where, `a skill local \`${step.skill}\` não existe. Crie com: npm --prefix pipeline run new-skill -- ${step.skill}`));
        continue;
      }
      // O SKILL.md deve citar os arquivos que promete gravar: se o flow.yaml
      // mudar e a skill não, as duas vão discordar sobre onde está o bastão.
      for (const output of step.outputs) {
        if (!skill.body.includes(output)) {
          issues.push(warning(where, `o SKILL.md de \`${step.skill}\` não menciona a saída \`${output}\``));
        }
      }
    } else {
      const entry = manifest.external.find((e) => e.source === step.source);
      if (!entry) {
        issues.push(error(where, `a fonte \`${step.source}\` não está no ${MANIFEST_FILE}`));
        continue;
      }
      if (!entry.skills.includes(step.skill)) {
        issues.push(error(where, `\`${step.skill}\` não está na lista de skills de \`${step.source}\` no ${MANIFEST_FILE}`));
        continue;
      }
      if (step.adapter === undefined) {
        issues.push(warning(where, 'skill externa sem `adapter`: ela não sabe de quais arquivos ler nem onde gravar'));
      }
    }
  }

  // 3. Skills de apoio (helpers) precisam existir em pipeline/skills/.
  for (const helper of flow.helpers) {
    if (!local.has(helper)) {
      issues.push(error(`${FLOW_FILE} › helpers`, `a skill de apoio \`${helper}\` não existe em ${LOCAL_SKILLS_DIR}/. Crie com: npm --prefix pipeline run new-skill -- ${helper}`));
    }
  }

  // 4. Instalação: as skills que o fluxo usa estão onde os agentes procuram?
  const needed = new Set<string>([ORCHESTRATOR, ...flow.steps.map((s) => s.skill), ...flow.helpers.filter((h) => local.has(h))]);
  for (const name of needed) {
    const installed = readInstalled(probe, name);
    const source = local.get(name);
    if (installed === null) {
      issues.push(warning(`skill ${name}`, 'não instalada para nenhum agente. Rode: npm --prefix pipeline run setup'));
    } else if (source && normalize(installed) !== normalize(source.text)) {
      issues.push(warning(`skill ${name}`, `${LOCAL_SKILLS_DIR}/${name} mudou desde o último setup. Rode: npm --prefix pipeline run setup`));
    }
  }

  // 5. Skills locais que ninguém usa.
  for (const dir of local.keys()) {
    if (dir !== ORCHESTRATOR && !flow.helpers.includes(dir) && !flow.steps.some((s) => s.source === 'local' && s.skill === dir)) {
      issues.push(warning(`${LOCAL_SKILLS_DIR}/${dir}`, 'skill local não usada em nenhuma etapa nem em `helpers` do flow.yaml'));
    }
  }

  return issues;
}

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trimEnd();
