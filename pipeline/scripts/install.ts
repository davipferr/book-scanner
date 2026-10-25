// npm --prefix pipeline run setup [-- --dry-run] [-- --local-only]
//
// Instala, para cada agente do pipeline/skills.json:
//   1. as skills externas (do skills.sh / GitHub) listadas em pipeline/skills.json
//   2. as skills locais de pipeline/skills/
// usando o CLI oficial `skills` (o mesmo do site skills.sh), a partir da raiz do
// repositório: é lá que os agentes procuram (.claude/skills/, .agents/skills/).
//
// O CLI COPIA as skills locais para .agents/skills/ (e cria um link em
// .claude/skills/). Por isso, depois de editar algo em pipeline/skills/, rode o setup
// de novo. O validate avisa quando a cópia instalada ficou para trás.
//
// Também liga o hook de pre-commit de pipeline/githooks/ (git config core.hooksPath).

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PIPELINE_DIR } from './lib/files.ts';
import { loadProject, printIssues, bold, dim, green, red } from './lib/project.ts';
import { installCommands, listLocalSkillDirs } from './lib/skills.ts';

const HOOKS_DIR = `${PIPELINE_DIR}/githooks`;
const LOCK_FILE = 'skills-lock.json';

const { values } = parseArgs({
  options: { 'dry-run': { type: 'boolean' }, 'local-only': { type: 'boolean' }, root: { type: 'string' } },
});
const project = loadProject(values.root);
if (!project.manifest) {
  printIssues(project.issues);
  process.exit(1);
}

const local = listLocalSkillDirs(project.root);
const manifest = values['local-only'] ? { ...project.manifest, external: [] } : project.manifest;
const commands = installCommands(manifest, local);

// O CLI envia telemetria anônima para o ranking do skills.sh. Desligada por padrão aqui;
// rode com DISABLE_TELEMETRY=0 se quiser contribuir com o ranking.
const env = { ...process.env, DISABLE_TELEMETRY: process.env.DISABLE_TELEMETRY ?? '1' };

console.log(bold(`\nInstalando skills para: ${manifest.agents.join(', ')}\n`));
for (const command of commands) {
  console.log(`${dim('$')} npx ${command.args.join(' ')}  ${dim(`# ${command.label}`)}`);
  if (values['dry-run']) continue;
  const result = spawnSync('npx', command.args, {
    cwd: project.root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32', // npx é npx.cmd no Windows
  });
  if (result.status !== 0) {
    console.error(red(`\nFalhou: ${command.label}. Veja a saída acima.`));
    process.exit(result.status ?? 1);
  }
}

// O CLI grava o skills-lock.json (as versões instaladas) na raiz. Ele é do pipeline:
// vai para pipeline/, para a raiz ficar só com o produto e as instruções dos agentes.
// Num projeto que já versionava o seu skills-lock.json na raiz (antes do adopt), ele é
// do projeto: fica lá, e o pipeline/ recebe uma cópia.
const git = (...args: string[]) => spawnSync('git', args, { cwd: project.root, encoding: 'utf8' });
const rootLock = join(project.root, LOCK_FILE);
if (!values['dry-run'] && existsSync(rootLock)) {
  const pipelineLock = join(project.root, PIPELINE_DIR, LOCK_FILE);
  if (git('ls-files', '--error-unmatch', LOCK_FILE).status === 0) copyFileSync(rootLock, pipelineLock);
  else renameSync(rootLock, pipelineLock);
}

// Liga o hook de pre-commit versionado em pipeline/githooks/ (regras duras antes de cada commit).
// Não mexe se o projeto já usa outro lugar para hooks (ex.: husky).
if (!values['dry-run'] && existsSync(join(project.root, HOOKS_DIR, 'pre-commit')) && git('rev-parse', '--git-dir').status === 0) {
  const current = git('config', '--get', 'core.hooksPath').stdout.trim();
  if (current === '' || current === '.githooks') {
    git('config', 'core.hooksPath', HOOKS_DIR);
    console.log(green(`\n✔ hook de pre-commit ativado (${HOOKS_DIR}/pre-commit roda o check do pipeline)`));
  } else if (current !== HOOKS_DIR) {
    console.log(dim(`\nOs hooks do git já apontam para ${current}: chame \`npm --prefix ${PIPELINE_DIR} run precommit\` no seu pre-commit.`));
  }
}

const next = `npm --prefix ${PIPELINE_DIR} run validate`;
console.log(green(values['dry-run'] ? '\n(dry-run: nada foi instalado)\n' : `\n✔ skills instaladas. Rode \`${next}\` para conferir.\n`));
