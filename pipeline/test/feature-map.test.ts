// O pipeline/FEATURE-MAP.md só serve se estiver em dia. Este teste falha quando um
// comando, um script ou uma skill aparece no pipeline e não no mapa.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { REPO_ROOT } from '../scripts/lib/files.ts';
import { listLocalSkillDirs } from '../scripts/lib/skills.ts';

const pipeline = new URL('..', import.meta.url);
const map = readFileSync(new URL('FEATURE-MAP.md', pipeline), 'utf8');
const missing = (names: string[], mention: (name: string) => string[]) =>
  names.filter((name) => !mention(name).some((text) => map.includes(text)));

describe('FEATURE-MAP.md', () => {
  it('cita cada comando do pipeline/package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('package.json', pipeline), 'utf8')) as { scripts: Record<string, string> };
    const names = Object.keys(pkg.scripts);
    assert.deepEqual(missing(names, (n) => [`pipeline run ${n}`, `pipeline ${n}`]), [], 'adicione estes comandos ao FEATURE-MAP.md');
  });

  it('cita cada script de pipeline/scripts/', () => {
    const files = readdirSync(new URL('scripts/', pipeline)).filter((f) => f.endsWith('.ts'));
    assert.deepEqual(missing(files, (f) => [`scripts/${f}`]), [], 'adicione estes scripts ao FEATURE-MAP.md');
  });

  it('cita cada skill de pipeline/skills/', () => {
    const skills = listLocalSkillDirs(REPO_ROOT);
    assert.ok(skills.length > 0);
    assert.deepEqual(missing(skills, (s) => [`skills/${s}/`]), [], 'adicione estas skills ao FEATURE-MAP.md');
  });
});
