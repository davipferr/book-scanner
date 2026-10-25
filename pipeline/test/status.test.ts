import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeStatus, verdictOf } from '../scripts/lib/status.ts';
import type { Step } from '../scripts/lib/flow.ts';
import { flowOf, memProbe, step } from './helpers.ts';

const flow = flowOf(
  step({ id: 'a', outputs: ['a.md'] }),
  step({ id: 'b', inputs: ['a.md'], outputs: ['b.md'] }),
  step({ id: 'c', inputs: ['b.md'], outputs: ['c.md'] }),
);

/** Um artefato que segue o contrato para a etapa `id` do fluxo acima. */
const art = (id: string, body = '# ok', extra = '') => {
  const s = flow.steps.find((x) => x.id === id) as Step;
  return `---\nstep: ${s.id}\nskill: ${s.skill}\ninputs: [${s.inputs.join(', ')}]\n${extra}---\n${body}\n`;
};

const states = (files: Parameters<typeof memProbe>[0], ignoreTime = false) =>
  computeStatus(flow, memProbe(files), { ignoreTime }).steps.map((s) => s.state);

describe('computeStatus', () => {
  it('sem arquivos: a primeira etapa pode rodar e as outras esperam', () => {
    const status = computeStatus(flow, memProbe({}));
    assert.deepEqual(status.steps.map((s) => s.state), ['ready', 'blocked', 'blocked']);
    assert.equal(status.next?.id, 'a');
  });

  it('avança conforme os bastões aparecem', () => {
    assert.deepEqual(states({ 'a.md': [art('a'), 1] }), ['done', 'ready', 'blocked']);
    assert.deepEqual(states({ 'a.md': [art('a'), 1], 'b.md': [art('b'), 2] }), ['done', 'done', 'ready']);
  });

  it('tudo pronto: next é null', () => {
    const status = computeStatus(flow, memProbe({ 'a.md': [art('a'), 1], 'b.md': [art('b'), 2], 'c.md': [art('c'), 3] }));
    assert.equal(status.next, null);
  });

  it('entrada editada depois da saída deixa a etapa desatualizada, e isso desce pelo fluxo', () => {
    // a.md foi editado (mtime 9) depois de b.md (2): b fica stale e c, que depende de b, também
    assert.deepEqual(states({ 'a.md': [art('a'), 9], 'b.md': [art('b'), 2], 'c.md': [art('c'), 3] }), ['done', 'stale', 'stale']);
  });

  it('--ignore-time ignora as datas (útil depois de um git clone)', () => {
    assert.deepEqual(states({ 'a.md': [art('a'), 9], 'b.md': [art('b'), 2], 'c.md': [art('c'), 3] }, true), ['done', 'done', 'done']);
  });

  it('status: in-progress no cabeçalho mantém a etapa em andamento e bloqueia a seguinte', () => {
    const partial = '---\nstep: b\nstatus: in-progress\n---\n# meio feito';
    const status = computeStatus(flow, memProbe({ 'a.md': [art('a'), 1], 'b.md': [partial, 2] }));
    assert.deepEqual(status.steps.map((s) => s.state), ['done', 'in-progress', 'blocked']);
    assert.equal(status.next?.id, 'b');
  });
});

describe('contrato dos artefatos', () => {
  it('artefato sem cabeçalho não conta como pronto e bloqueia a etapa seguinte', () => {
    const status = computeStatus(flow, memProbe({ 'a.md': ['# sem cabeçalho', 1] }));
    assert.deepEqual(status.steps.map((s) => s.state), ['invalid', 'blocked', 'blocked']);
    assert.equal(status.next?.id, 'a');
    assert.match(status.steps[1]?.reason ?? '', /a\.md não segue o contrato/);
  });

  it('acusa step, skill e inputs diferentes do flow.yaml', () => {
    const wrong = '---\nstep: x\nskill: y\ninputs: []\n---\n# b';
    const status = computeStatus(flow, memProbe({ 'a.md': [art('a'), 1], 'b.md': [wrong, 2] }));
    assert.equal(status.steps[1]?.state, 'invalid');
    assert.match(status.steps[1]?.reason ?? '', /`step` deveria ser b.*`skill` deveria ser b.*`inputs` deveria ser \[a\.md\]/);
  });

  it('a ordem dos inputs não importa', () => {
    const two = flowOf(step({ id: 'a', outputs: ['a.md'] }), step({ id: 'z', outputs: ['z.md'] }), step({ id: 'b', inputs: ['a.md', 'z.md'], outputs: ['b.md'] }));
    const files = {
      'a.md': ['---\nstep: a\nskill: a\ninputs: []\n---\n', 1] as [string, number],
      'z.md': ['---\nstep: z\nskill: z\ninputs: []\n---\n', 1] as [string, number],
      'b.md': ['---\nstep: b\nskill: b\ninputs: [z.md, a.md]\n---\n', 2] as [string, number],
    };
    assert.equal(computeStatus(two, memProbe(files)).next, null);
  });
});

describe('veredito (on_reject)', () => {
  const judged = flowOf(
    step({ id: 'impl', outputs: ['impl.md'] }),
    step({ id: 'verify', inputs: ['impl.md'], outputs: ['verify.md'], onReject: 'impl' }),
    step({ id: 'ship', inputs: ['verify.md'], outputs: ['ship.md'] }),
  );
  const impl = ['---\nstep: impl\nskill: impl\ninputs: []\n---\n', 1] as [string, number];
  const verify = (verdict: string, mtime = 2) =>
    [`---\nstep: verify\nskill: verify\ninputs: [impl.md]\n---\n# Verificação\n\n**Veredito:** ${verdict}\n`, mtime] as [string, number];

  it('reprovado trava a etapa seguinte e diz qual refazer', () => {
    const status = computeStatus(judged, memProbe({ 'impl.md': impl, 'verify.md': verify('reprovado') }));
    assert.deepEqual(status.steps.map((s) => s.state), ['done', 'rejected', 'blocked']);
    assert.equal(status.next?.id, 'verify');
    assert.equal(status.next?.redo, 'impl');
  });

  it('aprovado (mesmo com observação depois) libera a seguinte', () => {
    const status = computeStatus(judged, memProbe({ 'impl.md': impl, 'verify.md': verify('aprovado (1 observação)') }));
    assert.deepEqual(status.steps.map((s) => s.state), ['done', 'done', 'ready']);
  });

  it('refazer a implementação deixa a verificação desatualizada: ela roda de novo', () => {
    const status = computeStatus(judged, memProbe({ 'impl.md': [impl[0], 9], 'verify.md': verify('reprovado', 2) }));
    assert.equal(status.next?.id, 'verify');
    assert.equal(status.next?.state, 'stale');
  });

  it('sem veredito, ou com o do template sem preencher, a etapa está fora do contrato', () => {
    for (const v of ['', 'aprovado | reprovado']) {
      const status = computeStatus(judged, memProbe({ 'impl.md': impl, 'verify.md': verify(v) }));
      assert.equal(status.steps[1]?.state, 'invalid', `veredito "${v}"`);
    }
  });

  it('verdictOf lê só a primeira palavra da linha', () => {
    assert.equal(verdictOf('**Veredito:** Reprovado — 2 falhas'), 'reprovado');
    assert.equal(verdictOf('**Veredito:** aprovado'), 'aprovado');
    assert.equal(verdictOf('sem veredito'), null);
  });
});

describe('computeStatus com onboard pendente', () => {
  it('bloqueia toda etapa que não está pronta e diz o que falta', () => {
    const status = computeStatus(flow, memProbe({ 'a.md': [art('a'), 1] }), { onboard: ['falta o docs/FEATURE-MAP.md'] });
    assert.deepEqual(status.steps.map((s) => s.state), ['done', 'blocked', 'blocked']);
    assert.equal(status.onboard, 'falta o docs/FEATURE-MAP.md');
    assert.match(status.next?.reason ?? '', /skill onboard/);
  });

  it('sem pendência, onboard é null', () => {
    assert.equal(computeStatus(flow, memProbe({})).onboard, null);
  });
});
