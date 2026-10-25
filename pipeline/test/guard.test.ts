import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PIPELINE_DIR } from '../scripts/lib/files.ts';
import { activeRun, PIPELINE_PATHS, unapprovedEdits } from '../scripts/lib/guard.ts';
import { flowOf, memProbe, step } from './helpers.ts';

describe('guard', () => {
  const flow = flowOf(step({ id: 'um', outputs: ['docs/flow/01.md'] }), step({ id: 'dois', inputs: ['docs/flow/01.md'], outputs: ['docs/flow/02.md'] }));

  it('há execução em andamento quando algum artefato existe', () => {
    assert.equal(activeRun(flow, memProbe({})), false);
    assert.equal(activeRun(flow, memProbe({ 'docs/flow/01.md': 'x' })), true);
  });

  it('acusa só mudanças que o dono não aprovou com git add', () => {
    const porcelain = ['M  pipeline/skills/a/SKILL.md', ' M pipeline/flow.yaml', 'MM pipeline/scripts/x.ts', '?? pipeline/skills/nova/SKILL.md', 'A  pipeline/adapters/y.md', ''].join('\n');
    assert.deepEqual(unapprovedEdits(porcelain), ['pipeline/flow.yaml', 'pipeline/scripts/x.ts', 'pipeline/skills/nova/SKILL.md']);
  });

  it('protege a pasta pipeline/ inteira e as instruções dos agentes, e nada do produto', () => {
    assert.deepEqual(PIPELINE_PATHS, [PIPELINE_DIR, 'AGENTS.md', 'CLAUDE.md']);
  });
});

// As regras duras só valem se ninguém conseguir desligá-las no meio de uma execução:
// a cadeia inteira mora em pipeline/, que o guard protege.
describe('a cadeia de checagens', () => {
  const pipeline = new URL('..', import.meta.url);
  const pkg = JSON.parse(readFileSync(new URL('package.json', pipeline), 'utf8')) as { scripts: Record<string, string> };

  it('o pre-commit chama precommit, que chama check, que roda typecheck, testes, validate e guard', () => {
    assert.match(readFileSync(new URL('githooks/pre-commit', pipeline), 'utf8'), /npm --prefix pipeline run --silent precommit/);
    assert.equal(pkg.scripts.precommit, 'npm run check');
    for (const part of ['npm run typecheck', 'npm test', 'npm run validate', 'npm run guard']) {
      assert.ok(pkg.scripts.check?.includes(part), `o script check não roda "${part}"`);
    }
  });
});
