// npm --prefix pipeline run validate [-- --root <pasta>] [-- --strict]
//
// Confere se o fluxo fecha: skills existem e seguem o padrão, entradas vêm de
// etapas anteriores, cada arquivo tem um dono, skills externas estão no skills.json, artefatos ficam em docs/flow/ e o que é do pipeline fica em pipeline/.
// Sai com código 1 se houver erro (ou aviso, com --strict).

import { parseArgs } from 'node:util';
import { loadProject, printIssues, green, red, yellow, bold } from './lib/project.ts';
import { listLocalSkillDirs } from './lib/skills.ts';
import { validateProject } from './lib/validate.ts';

const { values } = parseArgs({ options: { root: { type: 'string' }, strict: { type: 'boolean' } } });
const project = loadProject(values.root);

const issues = [...project.issues];
if (project.flow && project.manifest) {
  issues.push(...validateProject(project.flow, project.manifest, listLocalSkillDirs(project.root), project.probe));
}

const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - errors;

console.log(bold(`\nValidando ${project.flow?.name ?? 'pipeline'} (${project.flow?.steps.length ?? 0} etapas)\n`));
printIssues(issues);
if (issues.length === 0) console.log(green('  ✔ tudo certo: o fluxo fecha e todas as skills estão no lugar'));
else console.log(`\n  ${errors ? red(`${errors} erro(s)`) : green('0 erros')}, ${warnings ? yellow(`${warnings} aviso(s)`) : '0 avisos'}`);
console.log();

process.exitCode = errors > 0 || (values.strict && warnings > 0) ? 1 : 0;
