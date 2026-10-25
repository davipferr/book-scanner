// npm --prefix pipeline run adopt -- <pasta-do-projeto> [--update] [--code <pasta>] [--dry-run] [--skip-install]
//
// Leva a base (o pipeline) deste repositório para outro projeto, sem depender de
// um agente seguir um checklist: copia pipeline/ (menos node_modules/), aponta
// `code` para o código do projeto, junta os blocos do AGENTS.md e do CLAUDE.md, o
// .gitignore e as skills que o projeto já tinha (skills-lock.json da raiz), e roda
// install + setup lá. Depois, o status do projeto pede a skill `onboard`.
//
// --update troca a base de um projeto que já adotou, preservando o que é dele
// (flow.yaml, skills.json, endurecimento.md, skills e evals que só existem lá).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import {
  copyPlan,
  externalFromLock,
  extractBlock,
  GITIGNORE_LINES,
  mergeExternal,
  missingLines,
  setCode,
  upsertBlock,
  withAgentsImport,
  type ManifestEntry,
} from './lib/adopt.ts';
import { PIPELINE_DIR, REPO_ROOT, userPath } from './lib/files.ts';
import { bold, dim, green, red, yellow } from './lib/project.ts';
import { INSTALL_DIRS } from './lib/skills.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    update: { type: 'boolean' },
    code: { type: 'string' },
    'dry-run': { type: 'boolean' },
    'skip-install': { type: 'boolean' },
  },
});

const usage = `Uso: npm --prefix ${PIPELINE_DIR} run adopt -- <pasta-do-projeto> [--update] [--code <pasta>] [--dry-run] [--skip-install]`;
const fail = (message: string): never => {
  console.error(red(`\n${message}\n`));
  process.exit(1);
};

const [targetArg] = positionals;
if (targetArg === undefined) fail(usage);
const source = resolve(REPO_ROOT);
const target = userPath(targetArg as string);
if (!existsSync(target) || !statSync(target).isDirectory()) fail(`${target} não existe ou não é uma pasta.`);
const inside = (dir: string, parent: string) => dir === parent || dir.startsWith(parent + sep);
if (inside(target, source)) fail(`${target} é este repositório (ou fica dentro dele): o adopt leva a base para OUTRO projeto.`);

const sourcePipeline = join(source, PIPELINE_DIR);
const targetPipeline = join(target, PIPELINE_DIR);
const update = values.update === true;
const dry = values['dry-run'] === true;
const hasPipeline = existsSync(targetPipeline);
if (hasPipeline && !update) {
  fail(`${targetPipeline} já existe. Para trocar a base por esta versão, rode com --update (preserva flow.yaml, skills.json e o que é do projeto).`);
}
if (hasPipeline && !existsSync(join(targetPipeline, 'flow.yaml'))) {
  fail(`${targetPipeline} existe mas não é o pipeline (não tem flow.yaml). Renomeie essa pasta ou mude PIPELINE_DIR em scripts/lib/files.ts.`);
}
if (update && !hasPipeline) fail(`--update, mas ${target} ainda não tem ${PIPELINE_DIR}/. Rode sem --update.`);
if (update && values.code !== undefined) fail('--code só vale na primeira adoção: numa atualização, mude `code` no pipeline/flow.yaml do projeto.');

const log: string[] = [];
const rel = (path: string) => relative(target, path).replaceAll('\\', '/');
function write(path: string, content: string) {
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (before === content) return;
  log.push(`  ${(before === null ? green('novo') : yellow('atualizado')).padEnd(11)} ${rel(path)}`);
  if (dry) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// 1. A base: os arquivos de pipeline/ que o git deste repositório conhece (versionados
//    ou novos, nunca os ignorados, como node_modules/).
const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', PIPELINE_DIR], { cwd: source, encoding: 'utf8' });
if (listed.status !== 0) fail(`Não consegui listar os arquivos da base com git: ${listed.stderr}`);
const templateFiles = listed.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .map((f) => f.slice(PIPELINE_DIR.length + 1))
  .filter((f) => existsSync(join(sourcePipeline, f)));
const targetFiles = hasPipeline ? walk(targetPipeline) : [];
const plan = copyPlan(templateFiles, targetFiles);

for (const file of plan.copy) write(join(targetPipeline, file), readFileSync(join(sourcePipeline, file), 'utf8'));
for (const file of plan.remove) {
  log.push(`  ${red('removido'.padEnd(11))} ${PIPELINE_DIR}/${file} ${dim('(saiu do template)')}`);
  if (!dry) rmSync(join(targetPipeline, file));
}

// 2. O que é do projeto: só na primeira adoção. Numa atualização, o dele fica.
const notes: string[] = [];
if (!update) {
  const code = values.code ?? '.';
  write(join(targetPipeline, 'flow.yaml'), setCode(readFileSync(join(sourcePipeline, 'flow.yaml'), 'utf8'), code));

  const manifest = JSON.parse(readFileSync(join(sourcePipeline, 'skills.json'), 'utf8')) as { external: ManifestEntry[] };
  const lockPath = join(target, 'skills-lock.json');
  if (existsSync(lockPath)) {
    const before = externalFromLock(readFileSync(lockPath, 'utf8')).map((e) => ({ ...e, why: 'já estavam no projeto antes do pipeline (skills-lock.json da raiz)' }));
    const merged = mergeExternal(manifest.external, before);
    manifest.external = merged.external;
    if (merged.added.length > 0) notes.push(`skills que o projeto já tinha, agora no ${PIPELINE_DIR}/skills.json: ${merged.added.join(', ')}`);
  }
  write(join(targetPipeline, 'skills.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

// 3. Instruções dos agentes: só o trecho entre os marcadores; o resto é do projeto.
for (const file of ['AGENTS.md', 'CLAUDE.md']) {
  const block = extractBlock(readFileSync(join(source, file), 'utf8'));
  if (block === null) fail(`O ${file} deste repositório não tem o bloco <!-- pipeline:start --> ... <!-- pipeline:end -->.`);
  const path = join(target, file);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const next = upsertBlock(current, block as string);
  write(path, file === 'CLAUDE.md' ? withAgentsImport(next) : next);
}

const ignorePath = join(target, '.gitignore');
const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
const missing = missingLines(ignore, GITIGNORE_LINES);
if (missing.length > 0) {
  write(ignorePath, `${ignore.trimEnd()}${ignore.trim() ? '\n\n' : ''}# Pipeline de skills: reproduzíveis com \`npm --prefix pipeline install\` e \`run setup\`\n${missing.join('\n')}\n`);
}

// 4. Skills que já estavam nas pastas dos agentes sem vir do skills.sh: a skill
//    `onboard` decide com o dono se viram skills do projeto em pipeline/skills/.
const lockText = existsSync(join(target, 'skills-lock.json')) ? readFileSync(join(target, 'skills-lock.json'), 'utf8') : '{}';
const fromLock = new Set(externalFromLock(lockText).flatMap((e) => e.skills));
const pipelineSkills = new Set(templateFiles.filter((f) => f.startsWith('skills/')).map((f) => f.split('/')[1]));
const loose = INSTALL_DIRS.flatMap((dir) => subdirs(join(target, dir)).map((name) => `${dir}/${name}`)).filter((path) => {
  const name = path.split('/').at(-1) ?? '';
  return !fromLock.has(name) && !pipelineSkills.has(name) && !existsSync(join(targetPipeline, 'skills', name));
});
if (loose.length > 0) notes.push(`skills soltas, fora do pipeline (a skill onboard vai perguntar o que fazer): ${loose.join(', ')}`);

console.log(bold(`\n${update ? 'Atualizando' : 'Adotando'} o pipeline em ${target}\n`));
console.log(log.length > 0 ? log.join('\n') : dim('  nada a mudar: a base já está em dia'));
for (const note of notes) console.log(yellow(`\n  ${note}`));

if (dry) {
  console.log(dim('\n(dry-run: nada foi gravado)\n'));
  process.exit(0);
}

// 5. Instala e confere, no projeto.
const run = (...args: string[]) => {
  console.log(dim(`\n$ npm --prefix ${PIPELINE_DIR} ${args.join(' ')}`));
  return spawnSync('npm', ['--prefix', PIPELINE_DIR, ...args], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' }).status;
};
if (!values['skip-install']) {
  if (run('install') !== 0) fail('npm install falhou no projeto. Veja a saída acima.');
  if (run('run', 'setup') !== 0) fail('O setup falhou no projeto. Veja a saída acima.');
  run('run', 'validate');
}

console.log(green(`\n✔ base ${update ? 'atualizada' : 'adotada'}.`));
console.log(`\n  Próximo passo: abra o agente em ${target} e diga ${bold('"faça o onboard do pipeline"')} (skill onboard).`);
console.log('  Ela escreve o docs/FEATURE-MAP.md do projeto e procura skills para ele com a find-skills.');
console.log(dim(`  Até lá, o validate falha e o status bloqueia as etapas.${values['skip-install'] ? ` Antes: npm --prefix ${PIPELINE_DIR} install e npm --prefix ${PIPELINE_DIR} run setup.` : ''}\n`));

function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === 'node_modules') return [];
    const path = prefix ? `${prefix}/${d.name}` : d.name;
    return d.isDirectory() ? walk(join(dir, d.name), path) : [path];
  });
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name);
  } catch {
    return [];
  }
}
