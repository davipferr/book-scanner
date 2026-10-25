# Montar o seu próprio fluxo

O fluxo "ideia → feature" é só um exemplo. O mecanismo (skills + `pipeline/flow.yaml` + artefatos + maestro) serve para qualquer processo com etapas. Tudo o que você muda aqui é base: fica dentro de `pipeline/`.

## Mudanças pequenas

**Tirar uma etapa.** Ex.: pular o interrogatório. Remova o item do `flow.yaml` e tire `docs/flow/02-decisoes.md` dos `inputs` de quem o lia (`prd`). O `validate` aponta exatamente quem ficou lendo um arquivo que ninguém mais produz. Lembre de ajustar o `SKILL.md` de `write-prd`, que também cita esse arquivo.

**Trocar a skill de uma etapa.** Mude `skill` e `source`. Se a nova skill for externa, registre no `skills.json` e escreva o adapter.

**Reordenar.** Mova o bloco no `flow.yaml`. Se alguma etapa passar a ler algo produzido depois dela, o `validate` acusa.

## Um fluxo novo do zero

Exemplo: **post de blog** (pesquisa → roteiro → rascunho → revisão).

### 1. Desenhe no papel primeiro

Para cada etapa, responda:

| Etapa | Que pergunta ela responde? | Precisa de humano? | Lê | Grava |
|-------|----------------------------|--------------------|----|-------|
| pesquisa | o que já existe sobre o tema? | não | (pedido do usuário) | `01-pesquisa.md` |
| roteiro | qual é o argumento, em que ordem? | sim | 01 | `02-roteiro.md` |
| rascunho | como fica escrito? | não | 02 | `03-rascunho.md` |
| revisão | está claro, correto, no tom certo? | não | 02, 03 | `04-revisao.md` |

Se uma etapa grava dois arquivos que nunca são lidos separadamente, junte num só. Se uma etapa precisa de "tudo", provavelmente é grande demais: quebre-a.

### 2. Procure skills prontas antes de escrever

```bash
npx skills find writing
```

No skills.sh, olhe também os *packs* e as *official skills*. Para cada etapa, decida: skill pronta + adapter, ou skill sua.

### 3. Escreva o `flow.yaml`

```yaml
name: post-de-blog
description: Do tema ao post revisado.
steps:
  - id: research
    title: Pesquisa
    skill: research-topic
    source: local
    inputs: []
    outputs: [docs/flow/01-pesquisa.md]
  # ...
```

### 4. Crie as skills que faltam

```bash
npm --prefix pipeline run new-skill -- research-topic "..."
```

### 5. Adapte o maestro e o final

- O maestro e o `npm --prefix pipeline run status` tratam o artefato da **última etapa** do `flow.yaml` como o final; não há nome fixo para trocar.
- `pipeline/scripts/archive.ts` usa o título do `01-ideia.md` para nomear a pasta. Se o seu primeiro artefato tiver outro nome, ajuste a leitura do título nesse script.

### 6. Feche o ciclo

```bash
npm --prefix pipeline run validate
```

```bash
npm --prefix pipeline run setup
```

```bash
npm --prefix pipeline run diagram -- --write
```

## Levar o pipeline para outro repositório

A regra é uma só: **a base vai inteira, o produto não vai.**

| Vai (base) | Não vai (produto) |
|---|---|
| a pasta `pipeline/` (menos `node_modules/`) | `docs/flow/`, `docs/runs/` |
| o bloco entre `<!-- pipeline:start -->` e `<!-- pipeline:end -->` do `AGENTS.md` e do `CLAUDE.md` | `workspace/` (o código gerado aqui) |

Nada do pipeline entra no código do projeto nem no `package.json` dele: os comandos rodam com `npm --prefix pipeline run <comando>`, com as dependências do próprio `pipeline/`.

Quem leva a base é um comando, não um agente seguindo um checklist: um agente que só "olha a estrutura" deste repositório monta uma versão mais leve e deixa de fora o que garante a qualidade (verify, investigate, guard, o mapa). Foi o que aconteceu antes deste comando existir.

### Projeto que já existe

Na pasta do projeto, rode o `adopt` **deste** repositório (troque o caminho pelo da sua máquina):

```bash
npm --prefix C:/Users/davip/Documents/projetos/js/agent-skills-pipeline/pipeline run adopt -- . --dry-run
```

O `--dry-run` mostra o que vai ser copiado e o que muda no que já existe, sem gravar. Sem ele, o `adopt`:

1. copia `pipeline/` inteira, sem `node_modules/`, e para se o projeto já tiver uma pasta `pipeline/`;
2. põe `code: .` no `pipeline/flow.yaml` (ou a pasta de `--code`, ex.: `--code apps/web`);
3. junta o bloco do pipeline ao `AGENTS.md` e ao `CLAUDE.md` do projeto, sem apagar o que já existe (o `CLAUDE.md` passa a começar com `@AGENTS.md`), e acrescenta ao `.gitignore` o que falta;
4. passa as skills do skills.sh que o projeto já tinha (o `skills-lock.json` da raiz) para o `pipeline/skills.json`, e lista as skills soltas em `.claude/skills/` e `.agents/skills/`;
5. roda `npm --prefix pipeline install`, `npm --prefix pipeline run setup` (instala as skills e liga o pre-commit) e `npm --prefix pipeline run validate` no projeto.

Depois, abra o agente no projeto e diga:

> Faça o onboard do pipeline.

A skill [`onboard`](../skills/onboard/SKILL.md) escreve o `docs/FEATURE-MAP.md` do código que já existe e usa a `find-skills` para procurar no skills.sh as skills que servem para a stack do projeto (com a sua aprovação). Até ela terminar, o `validate` falha e o `status` bloqueia todas as etapas, então não dá para pular. Aí é só "rode o pipeline".

Se o projeto usa outro lugar para os hooks do git (ex.: husky), o `setup` avisa: acrescente `npm --prefix pipeline run precommit` no pre-commit dele.

### Projeto novo

Ou comece por uma cópia deste repositório e apague os produtos que vieram junto (o conteúdo de `docs/runs/` e de `docs/flow/`, e `workspace/` se existir), ou rode o `adopt` numa pasta vazia com `--code workspace`. O código vai para `workspace/` e o mapa de cada execução fica no `05-implementacao.md` (não há onboard: não há código anterior).

### Atualizar um projeto quando este template evoluir

Na pasta do projeto:

```bash
npm --prefix C:/Users/davip/Documents/projetos/js/agent-skills-pipeline/pipeline run adopt -- . --update --dry-run
```

O `--update` troca a base pela versão nova e preserva o que é do projeto dentro dela: o `flow.yaml`, o `skills.json`, o `endurecimento.md` e as skills e os casos de `evals/` que só existem lá. Apaga os arquivos da base que saíram do template. No `AGENTS.md` e no `CLAUDE.md`, troca só o que está entre os marcadores. Se o template ganhou etapas ou `helpers` novos, compare o `flow.yaml` do projeto com o daqui e traga o que quiser à mão. No fim, rode `npm --prefix pipeline run check`.

## Princípios que valem para qualquer fluxo

1. **Uma etapa, um artefato, um dono.** Facilita tudo: estado, revisão e refazer.
2. **Etapas que precisam de humano são explícitas** (`interactive: true`). O maestro para nelas.
3. **A última etapa é para quem não acompanhou.** Ninguém vai ler os seis artefatos do meio.
4. **Determinístico em script, julgamento em skill.** Contar arquivos, comparar datas e validar YAML é com código; decidir escopo e escrever é com o agente.
5. **Alguma etapa prova que funciona antes de alguém aprovar.** No fluxo de exemplo é a `verify`; num fluxo de blog seria abrir o post renderizado e checar os links. Veja [Confiar nos agentes](confiar-nos-agentes.md).
