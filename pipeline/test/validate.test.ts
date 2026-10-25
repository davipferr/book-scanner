import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFlow } from '../scripts/lib/flow.ts';
import type { Manifest } from '../scripts/lib/skills.ts';
import { validateProject } from '../scripts/lib/validate.ts';
import { flowOf, memProbe, skillMd, step } from './helpers.ts';

const manifest: Manifest = { agents: ['claude-code'], external: [{ source: 'dono/repo', skills: ['externa'] }] };

/** Projeto mínimo válido: duas skills locais instaladas + o orquestrador. */
function project(extra: Record<string, string> = {}) {
  const files: Record<string, string> = {
    'AGENTS.md': '<!-- pipeline:start -->\n# Pipeline\n<!-- pipeline:end -->\n',
    'pipeline/skills/run-pipeline/SKILL.md': skillMd('run-pipeline'),
    'pipeline/skills/primeira/SKILL.md': skillMd('primeira', 'Grava `docs/flow/a.md`.'),
    'pipeline/skills/segunda/SKILL.md': skillMd('segunda', 'Lê docs/flow/a.md e grava `docs/flow/b.md`.'),
    ...extra,
  };
  for (const name of ['run-pipeline', 'primeira', 'segunda', 'externa']) {
    files[`.agents/skills/${name}/SKILL.md`] ??= files[`pipeline/skills/${name}/SKILL.md`] ?? skillMd(name);
  }
  return files;
}
const dirs = ['primeira', 'run-pipeline', 'segunda'];

const messages = (flow: ReturnType<typeof flowOf>, files = project(), localDirs = dirs) =>
  validateProject(flow, manifest, localDirs, memProbe(files)).map((i) => `${i.level}: ${i.message}`);

const valid = flowOf(
  step({ id: 'um', skill: 'primeira', outputs: ['docs/flow/a.md'] }),
  step({ id: 'dois', skill: 'segunda', inputs: ['docs/flow/a.md'], outputs: ['docs/flow/b.md'] }),
);

describe('validateProject', () => {
  it('um fluxo bem formado não tem problemas', () => {
    assert.deepEqual(messages(valid), []);
  });

  it('on_reject só pode voltar para uma etapa anterior', () => {
    const back = flowOf(valid.steps[0]!, { ...valid.steps[1]!, onReject: 'um' });
    assert.deepEqual(messages(back), []);
    for (const target of ['dois', 'nao-existe']) {
      const bad = flowOf(valid.steps[0]!, { ...valid.steps[1]!, onReject: target });
      assert.match(messages(bad).join('\n'), new RegExp(`error: \`on_reject: ${target}\` precisa ser o id de uma etapa anterior`));
    }
  });

  it('base × produto: artefato fora de docs/flow/ e adapter fora de pipeline/ são erro', () => {
    const flow = flowOf(
      step({ id: 'um', skill: 'primeira', outputs: ['pipeline/a.md'] }),
      step({ id: 'tres', skill: 'externa', source: 'dono/repo', inputs: ['pipeline/a.md'], outputs: ['docs/flow/c.md'], adapter: 'adapters/x.md' }),
    );
    const text = messages(flow, project({ 'adapters/x.md': '# x' })).join('\n');
    assert.match(text, /a saída `pipeline\/a.md` precisa ficar em docs\/flow\//);
    assert.match(text, /o adapter `adapters\/x.md` precisa ficar em pipeline\//);
  });

  it('avisa quando o AGENTS.md não tem o bloco do pipeline', () => {
    const files = project({ 'AGENTS.md': '# Instruções do projeto\n' });
    assert.match(messages(valid, files).join('\n'), /warning: falta o bloco do pipeline/);
  });

  it('code não pode ficar dentro do pipeline nem dos artefatos', () => {
    assert.doesNotMatch(messages({ ...valid, code: '.' }).join('\n'), /o código é do projeto/);
    for (const code of ['pipeline', 'pipeline/app', 'docs/flow', 'docs/runs/x']) {
      assert.match(messages({ ...valid, code }).join('\n'), /o código é do projeto/, code);
    }
  });

  it('acusa entrada produzida por uma etapa que vem depois', () => {
    const flow = flowOf(valid.steps[1]!, valid.steps[0]!);
    assert.match(messages(flow).join('\n'), /error: lê `docs\/flow\/a.md`, mas quem o produz \(um\) vem depois/);
  });

  it('acusa entrada que ninguém produz', () => {
    const flow = flowOf(step({ id: 'um', skill: 'primeira', inputs: ['docs/flow/fantasma.md'], outputs: ['docs/flow/a.md'] }), valid.steps[1]!);
    assert.match(messages(flow).join('\n'), /error: lê `docs\/flow\/fantasma.md`, que nenhuma etapa produz/);
  });

  it('acusa arquivo com dois donos', () => {
    const flow = flowOf(valid.steps[0]!, step({ id: 'dois', skill: 'segunda', outputs: ['docs/flow/a.md', 'docs/flow/b.md'] }));
    assert.match(messages(flow).join('\n'), /`docs\/flow\/a.md` já é saída de um/);
  });

  it('acusa skill local inexistente e sugere o comando para criá-la', () => {
    const flow = flowOf(step({ id: 'um', skill: 'nao-existe', outputs: ['docs/flow/a.md'] }));
    assert.match(messages(flow).join('\n'), /npm --prefix pipeline run new-skill -- nao-existe/);
  });

  it('acusa SKILL.md cujo name não bate com a pasta', () => {
    const files = project({ 'pipeline/skills/segunda/SKILL.md': skillMd('outro-nome', 'grava `docs/flow/b.md`') });
    assert.match(messages(valid, files).join('\n'), /precisa ser igual ao nome da pasta \(segunda\)/);
  });

  it('skill externa precisa estar no skills.json', () => {
    const flow = flowOf(...valid.steps, step({ id: 'tres', skill: 'externa', source: 'outro/repo', inputs: ['docs/flow/b.md'], outputs: ['docs/flow/c.md'] }));
    assert.match(messages(flow).join('\n'), /a fonte `outro\/repo` não está no pipeline\/skills.json/);
  });

  it('skill externa sem adapter gera aviso', () => {
    const flow = flowOf(...valid.steps, step({ id: 'tres', skill: 'externa', source: 'dono/repo', inputs: ['docs/flow/b.md'], outputs: ['docs/flow/c.md'] }));
    assert.deepEqual(messages(flow), ['warning: skill externa sem `adapter`: ela não sabe de quais arquivos ler nem onde gravar']);
  });

  it('avisa quando a skill local foi editada depois do setup', () => {
    const files = project({ '.agents/skills/segunda/SKILL.md': skillMd('segunda', 'versão antiga') });
    assert.match(messages(valid, files).join('\n'), /skills\/segunda mudou desde o último setup/);
  });

  it('helpers: skill de apoio inexistente é erro, e existente não conta como "não usada"', () => {
    const files = project({ 'pipeline/skills/apoio/SKILL.md': skillMd('apoio'), '.agents/skills/apoio/SKILL.md': skillMd('apoio') });
    const withHelper = { ...valid, helpers: ['apoio'] };
    assert.deepEqual(messages(withHelper, files, [...dirs, 'apoio']), []);
    assert.match(messages({ ...valid, helpers: ['fantasma'] }).join('\n'), /a skill de apoio `fantasma` não existe/);
  });

  it('avisa quando o SKILL.md não cita a saída que o flow.yaml promete', () => {
    const flow = flowOf(valid.steps[0]!, step({ id: 'dois', skill: 'segunda', inputs: ['docs/flow/a.md'], outputs: ['docs/flow/outro.md'] }));
    assert.match(messages(flow).join('\n'), /não menciona a saída `docs\/flow\/outro.md`/);
  });
});

describe('parseFlow', () => {
  it('lê um flow.yaml válido', () => {
    const { flow, issues } = parseFlow('name: x\nsteps:\n  - id: a\n    skill: a\n    source: local\n    inputs: []\n    outputs: [docs/flow/a.md]\n');
    assert.deepEqual(issues, []);
    assert.equal(flow?.steps[0]?.title, 'a');
  });

  it('code: workspace por padrão, normaliza ./ e barras', () => {
    const base = 'name: x\nsteps:\n  - id: a\n    skill: a\n    source: local\n    inputs: []\n    outputs: [docs/flow/a.md]\n';
    assert.equal(parseFlow(base).flow?.code, 'workspace');
    for (const [raw, code] of [['./app/', 'app'], ['.', '.'], ['./', '.'], ['apps\\web', 'apps/web']]) {
      assert.equal(parseFlow(`code: '${raw}'\n${base}`).flow?.code, code, raw);
    }
  });

  it('aponta campos obrigatórios que faltam', () => {
    const { flow, issues } = parseFlow('name: x\nsteps:\n  - id: a\n    inputs: []\n');
    assert.equal(flow, null);
    assert.deepEqual(issues.map((i) => i.message), ['`skill` é obrigatório', '`source` é obrigatório', '`outputs` precisa ser uma lista de caminhos (use [] se vazia)']);
  });
});

describe('onboard (projeto que já existia)', () => {
  const existing = { ...valid, code: '.' };
  const map = [
    '# Mapa',
    '## Instalar e rodar',
    '- Testes: `npm test`',
    '## Funcionalidades',
    '| Funcionalidade | Como acionar | Código | Teste |',
    '|---|---|---|---|',
    '| Login | `/login` | `src/auth.ts` | `test/auth.test.ts` |',
    '## Skills do projeto',
    '- nenhuma',
  ].join('\n');
  const text = (files: Record<string, string>) => messages(existing, project(files)).join('\n');

  it('num projeto novo (code: workspace) não pede o mapa', () => {
    assert.deepEqual(messages(valid), []);
  });

  it('sem docs/FEATURE-MAP.md é erro, e a mensagem manda rodar a skill onboard', () => {
    assert.match(text({}), /error: falta o docs\/FEATURE-MAP.md.*skill onboard/);
  });

  it('o mapa precisa das três seções e de pelo menos uma funcionalidade', () => {
    assert.equal(text({ 'docs/FEATURE-MAP.md': map }), '');
    assert.match(text({ 'docs/FEATURE-MAP.md': map.replace('## Skills do projeto', '## Outra') }), /sem a seção "## Skills do projeto"/);
    assert.match(text({ 'docs/FEATURE-MAP.md': map.replace(/^\| Login.*$/m, '') }), /não tem nenhuma linha/);
  });
});
