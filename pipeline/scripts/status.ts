// npm --prefix pipeline run status [-- --json] [-- --dir <pasta>] [-- --ignore-time]
//
// Mostra em que etapa o pipeline está e, num projeto que já existia, se falta o onboard.
// A skill run-pipeline chama este script com --json para decidir o que fazer, em vez de adivinhar olhando os arquivos.
// --dir lê os artefatos de outra pasta, usando o pipeline/flow.yaml. Aceita os dois
// formatos: com docs/flow/ dentro (um repositório inteiro) ou com os artefatos
// soltos, como o archive grava (docs/runs/<execução>).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { diskProbe, flattenProbe, FLOW_DIR, userPath, type FileProbe } from './lib/files.ts';
import { onboardProblems } from './lib/onboard.ts';
import { computeStatus, type StepState } from './lib/status.ts';
import { loadProject, printIssues, bold, cyan, dim, green, red, yellow } from './lib/project.ts';

const { values } = parseArgs({
  options: { json: { type: 'boolean' }, dir: { type: 'string' }, 'ignore-time': { type: 'boolean' } },
});
const project = loadProject();

if (!project.flow) {
  if (values.json) console.log(JSON.stringify({ error: project.issues.map((i) => `${i.where}: ${i.message}`) }));
  else printIssues(project.issues);
  process.exit(1);
}

const FLOW_PREFIX = `${FLOW_DIR}/`;
// Execução arquivada: artefatos soltos na pasta, sem docs/flow/ dentro.
const flat = values.dir !== undefined && !existsSync(join(userPath(values.dir), FLOW_DIR));
const probe = values.dir ? withLayout(diskProbe(userPath(values.dir))) : project.probe;
// Uma execução arquivada não depende do onboard: ele é do projeto, não da execução.
const onboard = values.dir ? [] : onboardProblems(project.flow, project.probe);
const status = computeStatus(project.flow, probe, { ignoreTime: values['ignore-time'], onboard });

if (values.json) {
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

const icons: Record<StepState, string> = {
  done: green('✔'),
  stale: yellow('↻'),
  'in-progress': cyan('◐'),
  invalid: red('✘'),
  rejected: red('✘'),
  ready: cyan('▶'),
  blocked: dim('·'),
};
const labels: Record<StepState, string> = {
  done: 'pronta',
  stale: 'desatualizada',
  'in-progress': 'em andamento',
  invalid: 'fora do contrato',
  rejected: 'reprovada',
  ready: 'pode rodar',
  blocked: 'bloqueada',
};

console.log(bold(`\n${status.flow}\n`));
const idWidth = Math.max(...status.steps.map((s) => s.id.length));
const skillWidth = Math.max(...status.steps.map((s) => s.skill.length));
for (const step of status.steps) {
  const current = step === status.next ? bold(' ← próxima') : '';
  console.log(
    `  ${icons[step.state]} ${step.id.padEnd(idWidth)}  ${dim(step.skill.padEnd(skillWidth))}  ${labels[step.state].padEnd(17)} ${dim(step.reason)}${current}`,
  );
}

if (status.onboard !== null) {
  console.log(red(`\n  Antes da primeira execução: ${status.onboard}.`));
  console.log(`  Próximo passo: peça ao agente ${bold('"faça o onboard do pipeline"')} (skill onboard).\n`);
} else if (status.next === null) {
  const final = project.flow.steps.at(-1)?.outputs.map(location).join(', ') ?? 'o último artefato';
  const archive = values.dir ? '' : ' e rode `npm --prefix pipeline run archive` para começar outro';
  console.log(green(`\n  Pipeline concluído. Leia ${final}${archive}.\n`));
} else if (status.next.state === 'rejected') {
  console.log(red(`\n  ${status.next.id} reprovou. Próximo passo: refazer ${bold(status.next.redo ?? '?')} a partir das falhas registradas.\n`));
} else if (status.next.state === 'invalid') {
  console.log(red(`\n  O artefato de ${status.next.id} não segue o contrato: refaça a etapa (skill ${status.next.skill}).\n`));
} else if (status.next.state === 'blocked') {
  console.log(red(`\n  A próxima etapa (${status.next.id}) está bloqueada: ${status.next.reason}. Rode \`npm --prefix pipeline run validate\`.\n`));
} else {
  console.log(`\n  Próximo passo: peça ao agente ${bold('"rode o pipeline"')} (skill run-pipeline)`);
  console.log(`  ou chame direto a skill ${bold(status.next.skill)}.\n`);
}

function withLayout(probe: FileProbe): FileProbe {
  return flat ? flattenProbe(probe, FLOW_PREFIX) : probe;
}

/** Onde o arquivo de fato está, a partir da pasta em que o comando foi rodado. */
function location(path: string): string {
  if (values.dir === undefined) return path;
  const dir = values.dir.replaceAll('\\', '/').replace(/\/+$/, '');
  return `${dir}/${flat && path.startsWith(FLOW_PREFIX) ? path.slice(FLOW_PREFIX.length) : path}`;
}
