import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  copyPlan,
  externalFromLock,
  extractBlock,
  mergeExternal,
  missingLines,
  setCode,
  upsertBlock,
  withAgentsImport,
} from '../scripts/lib/adopt.ts';

const block = '<!-- pipeline:start -->\n# Pipeline\n<!-- pipeline:end -->';

describe('adopt: instruções dos agentes', () => {
  it('acrescenta o bloco no fim sem apagar o que o projeto já tinha', () => {
    assert.equal(upsertBlock('# Meu projeto\n\nRegras.\n', block), `# Meu projeto\n\nRegras.\n\n${block}\n`);
    assert.equal(upsertBlock('', block), `${block}\n`);
  });

  it('numa atualização, troca só o que está entre os marcadores', () => {
    const old = `# Meu projeto\n\n<!-- pipeline:start -->\nvelho\n<!-- pipeline:end -->\n\n## Depois\n`;
    assert.equal(upsertBlock(old, block), `# Meu projeto\n\n${block}\n\n## Depois\n`);
    assert.equal(extractBlock(old), '<!-- pipeline:start -->\nvelho\n<!-- pipeline:end -->');
    assert.equal(extractBlock('# sem bloco'), null);
  });

  it('o CLAUDE.md passa a importar o AGENTS.md, uma vez só', () => {
    assert.equal(withAgentsImport(`${block}\n`), `@AGENTS.md\n\n${block}\n`);
    assert.equal(withAgentsImport(`@AGENTS.md\n\n${block}\n`), `@AGENTS.md\n\n${block}\n`);
  });
});

describe('adopt: arquivos do projeto', () => {
  it('só pede ao .gitignore as linhas que faltam', () => {
    assert.deepEqual(missingLines('node_modules/\n/.claude/skills\n', ['.claude/skills/', '.agents/skills/']), ['.agents/skills/']);
  });

  it('troca a linha code do flow.yaml mantendo os comentários', () => {
    assert.equal(setCode('# comentário\ncode: workspace\nsteps: []\n', '.'), '# comentário\ncode: .\nsteps: []\n');
  });

  it('as skills do skills.sh que o projeto já tinha entram no skills.json, sem repetir', () => {
    const lock = JSON.stringify({
      skills: {
        tdd: { source: 'mattpocock/skills', sourceType: 'github' },
        'find-skills': { source: 'vercel-labs/skills', sourceType: 'github' },
        'dotnet-webapi': { source: 'dono/dotnet', sourceType: 'github' },
        minha: { source: './skills', sourceType: 'local' },
      },
    });
    const before = externalFromLock(lock);
    assert.deepEqual(before, [
      { source: 'mattpocock/skills', skills: ['tdd'] },
      { source: 'vercel-labs/skills', skills: ['find-skills'] },
      { source: 'dono/dotnet', skills: ['dotnet-webapi'] },
    ]);
    const { external, added } = mergeExternal(
      [{ source: 'mattpocock/skills', skills: ['grilling', 'tdd'] }, { source: 'vercel-labs/skills', skills: ['find-skills'] }],
      before,
    );
    assert.deepEqual(added, ['dono/dotnet/dotnet-webapi']);
    assert.deepEqual(external.map((e) => e.source), ['mattpocock/skills', 'vercel-labs/skills', 'dono/dotnet']);
    assert.deepEqual(externalFromLock('não é json'), []);
  });
});

describe('adopt: o que copiar e o que apagar', () => {
  const template = ['flow.yaml', 'skills.json', 'skills/verify/SKILL.md', 'scripts/status.ts', 'evals/README.md', 'evals/write-prd/caso.md'];

  it('não copia o que é do projeto (flow.yaml, skills.json, lock, endurecimento)', () => {
    assert.deepEqual(copyPlan([...template, 'skills-lock.json', 'endurecimento.md'], []).copy, [
      'skills/verify/SKILL.md',
      'scripts/status.ts',
      'evals/README.md',
      'evals/write-prd/caso.md',
    ]);
  });

  it('numa atualização, apaga o que saiu do template e preserva skills, casos e arquivos do projeto', () => {
    const target = [
      'flow.yaml',
      'skills.json',
      'endurecimento.md',
      'scripts/status.ts',
      'scripts/velho.ts',
      'skills/verify/velho.md',
      'skills/do-projeto/SKILL.md',
      'evals/do-projeto/caso.md',
      'node_modules/yaml/index.js',
    ];
    assert.deepEqual(copyPlan(template, target).remove, ['scripts/velho.ts', 'skills/verify/velho.md']);
  });
});

// O script de verdade, num projeto de mentira fora do repositório.
describe('adopt (script)', () => {
  const script = fileURLToPath(new URL('../scripts/adopt.ts', import.meta.url));
  const adopt = (dir: string, ...args: string[]) =>
    spawnSync(process.execPath, [script, dir, '--skip-install', ...args], { encoding: 'utf8' });

  it('leva a base inteira para um projeto que já existe e recusa uma segunda adoção', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adopt-'));
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '# Projeto\n\nRegra do projeto.\n');
      writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
      writeFileSync(join(dir, 'skills-lock.json'), JSON.stringify({ skills: { 'dotnet-webapi': { source: 'dono/dotnet', sourceType: 'github' } } }));
      mkdirSync(join(dir, '.claude', 'skills', 'solta'), { recursive: true });

      const dry = adopt(dir, '--dry-run');
      assert.equal(dry.status, 0, dry.stderr);
      assert.equal(existsSync(join(dir, 'pipeline')), false, 'o dry-run gravou algo');

      const first = adopt(dir);
      assert.equal(first.status, 0, first.stderr);
      for (const file of ['FEATURE-MAP.md', 'skills/onboard/SKILL.md', 'skills/verify/SKILL.md', 'scripts/guard.ts', 'githooks/pre-commit']) {
        assert.ok(existsSync(join(dir, 'pipeline', file)), `faltou pipeline/${file}`);
      }
      assert.equal(existsSync(join(dir, 'pipeline', 'node_modules')), false);
      assert.match(readFileSync(join(dir, 'pipeline', 'flow.yaml'), 'utf8'), /^code: \.$/m);
      const skills = readFileSync(join(dir, 'pipeline', 'skills.json'), 'utf8');
      assert.match(skills, /vercel-labs\/skills/);
      assert.match(skills, /dono\/dotnet/);
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
      assert.match(agents, /Regra do projeto\./);
      assert.match(agents, /<!-- pipeline:start -->[\s\S]*<!-- pipeline:end -->/);
      assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /^@AGENTS\.md/);
      assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /\.agents\/skills\//);
      assert.match(first.stdout, /\.claude\/skills\/solta/);

      assert.equal(adopt(dir).status, 1, 'adotou duas vezes sem --update');

      writeFileSync(join(dir, 'pipeline', 'flow.yaml'), 'name: do-projeto\ncode: .\nsteps: []\n');
      const update = adopt(dir, '--update');
      assert.equal(update.status, 0, update.stderr);
      assert.equal(readFileSync(join(dir, 'pipeline', 'flow.yaml'), 'utf8'), 'name: do-projeto\ncode: .\nsteps: []\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
