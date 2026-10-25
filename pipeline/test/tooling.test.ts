import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DIAGRAM_END, DIAGRAM_START, replaceDiagram, toMermaid } from '../scripts/lib/diagram.ts';
import { flattenProbe, parseFrontmatter } from '../scripts/lib/files.ts';
import { checkSkill, installCommands, parseManifest, SKILLS_CLI } from '../scripts/lib/skills.ts';
import { flowOf, memProbe, step } from './helpers.ts';

describe('flattenProbe', () => {
  it('procura docs/flow/* na raiz da pasta, como o archive grava', () => {
    const probe = flattenProbe(memProbe({ '01-ideia.md': ['ideia', 5] }), 'docs/flow/');
    assert.equal(probe.read('docs/flow/01-ideia.md'), 'ideia');
    assert.equal(probe.mtimeMs('docs/flow/01-ideia.md'), 5);
    assert.equal(probe.read('docs/flow/02-decisoes.md'), null);
  });
});

describe('parseFrontmatter', () => {
  it('separa cabeçalho e corpo (inclusive com quebras de linha do Windows)', () => {
    const fm = parseFrontmatter('---\r\nname: x\r\ndescription: y\r\n---\r\ncorpo');
    assert.deepEqual(fm?.data, { name: 'x', description: 'y' });
    assert.equal(fm?.body, 'corpo');
  });

  it('retorna null sem cabeçalho', () => {
    assert.equal(parseFrontmatter('# só markdown'), null);
  });
});

describe('checkSkill', () => {
  const base = { dir: 'minha-skill', name: 'minha-skill', description: 'Faz algo.', text: '', body: '' };

  it('aceita uma skill no padrão', () => {
    assert.deepEqual(checkSkill(base), []);
  });

  it('recusa name fora do padrão e description vazia', () => {
    const issues = checkSkill({ ...base, dir: 'Minha_Skill', name: 'Minha_Skill', description: ' ' });
    assert.deepEqual(issues.map((i) => i.message), [
      '`name` deve ser minúsculo-com-hifens, até 64 caracteres',
      'falta `description` no cabeçalho',
    ]);
  });
});

describe('installCommands', () => {
  it('gera um `npx skills add` por fonte externa e um para as skills locais', () => {
    const { manifest } = parseManifest(JSON.stringify({ agents: ['claude-code', 'codex'], external: [{ source: 'a/b', skills: ['x', 'y'] }] }));
    assert.ok(manifest);
    const commands = installCommands(manifest, ['local-1']);
    assert.deepEqual(commands.map((c) => c.args.join(' ')), [
      `-y ${SKILLS_CLI} add a/b --skill x y --agent claude-code codex --yes`,
      `-y ${SKILLS_CLI} add ./pipeline --skill local-1 --agent claude-code codex --yes`,
    ]);
  });

  it('recusa fonte que não é owner/repo', () => {
    const { manifest, issues } = parseManifest(JSON.stringify({ agents: ['codex'], external: [{ source: 'sem-barra', skills: ['x'] }] }));
    assert.equal(manifest, null);
    assert.match(issues[0]?.message ?? '', /owner\/repo/);
  });
});

describe('diagrama', () => {
  const flow = flowOf(
    step({ id: 'idea', title: 'Ideia', outputs: ['docs/flow/01.md'] }),
    step({ id: 'end', title: 'Fim', skill: 'ext', source: 'a/b', inputs: ['docs/flow/01.md'], outputs: ['docs/flow/02.md'] }),
  );

  it('desenha uma seta por arquivo passado entre etapas e evita palavras reservadas', () => {
    const mermaid = toMermaid(flow);
    assert.match(mermaid, /user -->\|ideia\| s_idea/);
    assert.match(mermaid, /s_idea -->\|01\.md\| s_end/);
    assert.match(mermaid, /class s_end external/);
  });

  it('desenha a volta tracejada das etapas com on_reject', () => {
    const judged = flowOf(flow.steps[0]!, { ...flow.steps[1]!, onReject: 'idea' });
    assert.match(toMermaid(judged), /s_end -\.->\|reprovado\| s_idea/);
  });

  it('substitui só o trecho entre os marcadores do README', () => {
    const readme = `antes\n${DIAGRAM_START}\nvelho\n${DIAGRAM_END}\ndepois`;
    const out = replaceDiagram(readme, 'novo');
    assert.equal(out, `antes\n${DIAGRAM_START}\n\`\`\`mermaid\nnovo\n\`\`\`\n${DIAGRAM_END}\ndepois`);
  });
});
