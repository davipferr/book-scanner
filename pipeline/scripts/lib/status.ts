import { parseFrontmatter, type FileProbe } from './files.ts';
import { producers, type Flow, type Step } from './flow.ts';

export type StepState = 'done' | 'stale' | 'in-progress' | 'invalid' | 'rejected' | 'ready' | 'blocked';

export interface StepStatus {
  id: string;
  title: string;
  skill: string;
  state: StepState;
  /** Por que a etapa está nesse estado, em uma frase. */
  reason: string;
  /** Só em `rejected`: a etapa que precisa ser refeita (o `on_reject` do flow.yaml). */
  redo?: string;
}

export interface PipelineStatus {
  flow: string;
  /** A pasta do código do projeto (o `code` do flow.yaml), para as skills saberem onde trabalhar. */
  code: string;
  steps: StepStatus[];
  /** A primeira etapa que não está `done`, ou `null` se o pipeline terminou. */
  next: StepStatus | null;
  /**
   * O que falta para o projeto poder rodar a primeira etapa (skill `onboard`), ou `null`.
   * Enquanto não for `null`, toda etapa que não está pronta fica bloqueada.
   */
  onboard: string | null;
}

export interface StatusOptions {
  /** Ignora datas de modificação (útil logo após um `git clone`, que reescreve todas). */
  ignoreTime?: boolean;
  /** Problemas de `onboardProblems`: enquanto houver algum, nenhuma etapa roda. */
  onboard?: string[];
}

/** Estados de uma etapa cuja saída a próxima não pode usar. */
const UNUSABLE: Record<string, string> = {
  stale: 'precisa ser refeito antes',
  'in-progress': 'ainda está em andamento',
  invalid: 'não segue o contrato dos artefatos',
  rejected: 'foi reprovado',
};

/**
 * Calcula o estado de cada etapa olhando só os arquivos, como o `make`:
 * não existe arquivo de estado escondido.
 */
export function computeStatus(flow: Flow, probe: FileProbe, options: StatusOptions = {}): PipelineStatus {
  const ownerOf = producers(flow);
  const states = new Map<string, StepState>();
  const onboard = options.onboard?.length ? options.onboard.join('; ') : null;
  const steps = flow.steps.map((step) => {
    let status = stepStatus(step, probe, options, (file) => {
      const owner = ownerOf.get(file);
      return owner ? states.get(owner) : undefined;
    });
    if (onboard !== null && status.state !== 'done') status = { ...status, state: 'blocked', reason: `falta o onboard (skill onboard): ${onboard}` };
    states.set(step.id, status.state);
    return status;
  });
  return { flow: flow.name, code: flow.code, steps, next: steps.find((s) => s.state !== 'done') ?? null, onboard };
}

function stepStatus(
  step: Step,
  probe: FileProbe,
  options: StatusOptions,
  producerState: (file: string) => StepState | undefined,
): StepStatus {
  const base = { id: step.id, title: step.title, skill: step.skill };
  const missingOutputs = step.outputs.filter((f) => probe.mtimeMs(f) === null);
  const unusable = (f: string) => {
    const state = producerState(f);
    return state !== undefined && state in UNUSABLE ? `${f} ${UNUSABLE[state]}` : null;
  };

  if (missingOutputs.length > 0) {
    const missingInputs = step.inputs.filter((f) => probe.mtimeMs(f) === null);
    if (missingInputs.length > 0) return { ...base, state: 'blocked', reason: `falta ${missingInputs.join(', ')}` };
    const notReady = step.inputs.map(unusable).filter((r) => r !== null);
    if (notReady.length > 0) return { ...base, state: 'blocked', reason: notReady.join('; ') };
    return { ...base, state: 'ready', reason: `vai gravar ${missingOutputs.join(', ')}` };
  }

  const inProgress = step.outputs.filter((f) => {
    const fm = parseFrontmatter(probe.read(f) ?? '');
    return fm?.data.status === 'in-progress';
  });
  if (inProgress.length > 0) return { ...base, state: 'in-progress', reason: `${inProgress.join(', ')} marcado como status: in-progress` };

  const broken = step.outputs.flatMap((f) => contractProblems(step, f, probe.read(f) ?? ''));
  if (broken.length > 0) return { ...base, state: 'invalid', reason: broken.join('; ') };

  const outdatedUpstream = step.inputs.filter((f) => unusable(f) !== null);
  if (outdatedUpstream.length > 0) {
    return { ...base, state: 'stale', reason: `depende de ${outdatedUpstream.join(', ')}, que precisa ser refeito antes` };
  }

  if (!options.ignoreTime) {
    const oldestOutput = Math.min(...step.outputs.map((f) => probe.mtimeMs(f) ?? 0));
    const newer = step.inputs.filter((f) => (probe.mtimeMs(f) ?? 0) > oldestOutput);
    if (newer.length > 0) return { ...base, state: 'stale', reason: `${newer.join(', ')} mudou depois da saída` };
  }

  if (step.onReject !== undefined) {
    const rejected = step.outputs.filter((f) => verdictOf(probe.read(f) ?? '') === 'reprovado');
    if (rejected.length > 0) {
      return {
        ...base,
        state: 'rejected',
        reason: `${rejected.join(', ')} reprovou: refaça ${step.onReject} a partir das falhas registradas`,
        redo: step.onReject,
      };
    }
  }

  return { ...base, state: 'done', reason: step.outputs.join(', ') };
}

/**
 * O que o artefato descumpre do contrato (pipeline/skills/run-pipeline/references/contrato-dos-artefatos.md):
 * cabeçalho com `step`, `skill` e `inputs` iguais aos do flow.yaml e, nas etapas
 * com `on_reject`, um veredito preenchido.
 */
export function contractProblems(step: Step, file: string, text: string): string[] {
  const fm = parseFrontmatter(text);
  if (fm === null) return [`${file} não tem o cabeçalho (--- step / skill / inputs ---)`];
  const problems: string[] = [];
  if (fm.data.step !== step.id) problems.push(`${file}: \`step\` deveria ser ${step.id}`);
  if (fm.data.skill !== step.skill) problems.push(`${file}: \`skill\` deveria ser ${step.skill}`);
  const inputs = fm.data.inputs;
  const sameInputs =
    Array.isArray(inputs) && inputs.length === step.inputs.length && step.inputs.every((i) => inputs.includes(i));
  if (!sameInputs) problems.push(`${file}: \`inputs\` deveria ser [${step.inputs.join(', ')}]`);
  if (step.onReject !== undefined && verdictOf(fm.body) === null) {
    problems.push(`${file}: falta a linha "**Veredito:** aprovado" ou "**Veredito:** reprovado"`);
  }
  return problems;
}

/** Lê a linha `**Veredito:** aprovado | reprovado` (ignora o template sem preencher). */
export function verdictOf(text: string): 'aprovado' | 'reprovado' | null {
  const line = /^\*\*Veredito:\*\*\s*(.*)$/im.exec(text)?.[1]?.trim().toLowerCase() ?? '';
  if (/aprovado\s*\|\s*reprovado/.test(line)) return null;
  const word = /^(aprovado|reprovado)\b/.exec(line)?.[1];
  return word === 'aprovado' || word === 'reprovado' ? word : null;
}
