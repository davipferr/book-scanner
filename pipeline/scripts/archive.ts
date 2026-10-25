// npm --prefix pipeline run archive [-- --dry-run]
//
// Guarda os produtos da execução atual em docs/runs/<data>-<ideia>/: os artefatos
// de docs/flow/ e, num projeto novo, a pasta do código (`code` no flow.yaml, ex.:
// workspace/). Num projeto que já existia (`code: .`), o código fica onde está.
// Deixa docs/flow/ vazio para a próxima ideia. Só MOVE arquivos: nada é apagado.
// Não toca em pipeline/.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { FLOW_DIR, RUNS_DIR } from './lib/files.ts';
import { bold, dim, green, loadProject, printIssues } from './lib/project.ts';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, root: { type: 'string' } } });
const project = loadProject(values.root);
if (!project.flow) {
  printIssues(project.issues);
  process.exit(1);
}
const root = project.root;
const code = project.flow.code;
const flowDir = join(root, FLOW_DIR);

const artifacts = existsSync(flowDir) ? readdirSync(flowDir).filter((f) => f.endsWith('.md')) : [];
if (artifacts.length === 0) {
  console.log('docs/flow/ está vazio: não há execução para arquivar.');
  process.exit(0);
}

// Nome da pasta: data + título da ideia (linha "# Ideia: ..." do 01-ideia.md).
const idea = artifacts.includes('01-ideia.md') ? readFileSync(join(flowDir, '01-ideia.md'), 'utf8') : '';
const title = /^#\s+(?:Ideia:\s*)?(.+)$/m.exec(idea)?.[1] ?? 'execucao';
const slug = title
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 40);
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const target = join(root, RUNS_DIR, `${stamp}-${slug}`);

const moves: [string, string][] = artifacts.map((f) => [join(flowDir, f), join(target, f)]);
const codeDir = join(root, code);
if (code !== '.' && existsSync(codeDir)) moves.push([codeDir, join(target, code)]);

const rel = (path: string) => relative(root, path).replaceAll('\\', '/');
console.log(bold(`\nArquivando em ${rel(target)}\n`));
for (const [from, to] of moves) console.log(`  ${dim(rel(from))} → ${rel(to)}`);
if (values['dry-run']) {
  console.log('\n(dry-run: nada foi movido)\n');
  process.exit(0);
}

for (const [from, to] of moves) {
  mkdirSync(dirname(to), { recursive: true }); // `code` pode ser aninhado (ex.: apps/web)
  renameSync(from, to);
}
console.log(green('\n✔ execução arquivada. docs/flow/ está livre para a próxima ideia.\n'));
