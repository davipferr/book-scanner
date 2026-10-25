# Como o fluxo funciona

Caminhos de arquivo a partir da raiz do repositório. Tudo o que é o pipeline (a **base**) fica em `pipeline/`; o que uma execução gera (o **produto**) fica fora: `docs/flow/`, `docs/runs/` e a pasta do código.

## 1. O que é uma skill

Uma skill é uma **pasta com um `SKILL.md`**:

```markdown
---
name: write-prd                     # igual ao nome da pasta, minúsculo-com-hifens
description: Transforma a ideia...  # O QUE faz e QUANDO usar
---

# Instruções que o agente segue
...
```

A pasta também pode ter arquivos de apoio, como o `template.md` de cada etapa daqui ou os `references/` do maestro. O agente só abre esses arquivos quando o `SKILL.md` aponta para eles.

O ponto importante é **como o agente usa a skill**:

1. No início, ele lê só o `name` e a `description` de todas as skills instaladas. É pouco texto.
2. Quando o seu pedido combina com uma `description`, ele carrega o `SKILL.md` inteiro.
3. Se o `SKILL.md` citar outros arquivos, ele os lê só se precisar.

Por isso a **`description` é a parte mais importante**: é ela que faz a skill ser usada (ou ignorada). Boa description = o que faz + quando usar, com as palavras que o usuário diria.

## 2. Por que encadear skills por arquivos

Dava para escrever uma skill gigante "transforma ideia em feature". Este projeto separa em oito porque:

- **Cada skill faz uma coisa.** `write-prd` não sabe programar; `tdd` não sabe escrever PRD. Fica fácil trocar uma etapa sem mexer nas outras.
- **Dá para reaproveitar skills de terceiros.** `grilling` e `tdd` vêm do skills.sh, prontas e testadas por milhares de pessoas.
- **Arquivo é o único canal confiável entre etapas.** A conversa com o agente se perde (contexto cheio, sessão nova, outro agente). O arquivo fica. Se a etapa 4 rodar amanhã, no Codex, ela lê `03-prd.md` e continua.
- **Dá para ver tudo.** Cada decisão está num arquivo versionável.

Esse "bastão" tem um formato fixo, o [contrato dos artefatos](../skills/run-pipeline/references/contrato-dos-artefatos.md). Todo arquivo começa com um cabeçalho dizendo qual etapa o gravou, com qual skill e a partir de quais entradas.

## 3. O `flow.yaml` é a fonte da ordem

Nenhuma skill sabe qual etapa vem depois dela. Quem sabe é o [`pipeline/flow.yaml`](../flow.yaml):

```yaml
- id: prd
  title: PRD
  skill: write-prd          # quem faz
  source: local             # de onde vem a skill
  inputs: [docs/flow/01-ideia.md, docs/flow/02-decisoes.md]
  outputs: [docs/flow/03-prd.md]
```

As regras que o `npm --prefix pipeline run validate` garante:

| Regra | Por quê |
|-------|---------|
| Toda entrada é saída de uma etapa **anterior** | senão a etapa nunca poderia rodar |
| Todo arquivo tem **um único dono** | senão duas etapas brigam pelo mesmo arquivo |
| Toda skill local existe e segue o padrão (`name` = pasta, `description` presente) | senão o agente não a encontra |
| Toda skill externa está no `pipeline/skills.json` | senão o `setup` não a instala |
| Toda saída fica em `docs/flow/`, todo adapter em `pipeline/`, e `code` (a pasta do código) fora de `pipeline/` e de `docs/` | base e produto nunca se misturam |
| O `SKILL.md` local cita os arquivos de saída que o `flow.yaml` promete | detecta quando um dos dois foi editado e o outro não |
| A cópia instalada bate com `pipeline/skills/` | o CLI copia as skills locais; editar sem rodar `setup` deixa o agente com a versão velha |

## 4. Estado sem banco de dados

`npm --prefix pipeline run status` calcula o estado de cada etapa **só olhando os arquivos**, como o `make`:

| Estado | Quando |
|--------|--------|
| `done` | todas as saídas existem e são mais novas que as entradas |
| `stale` | uma entrada mudou depois da saída, ou a etapa anterior está desatualizada |
| `in-progress` | a saída existe, mas tem `status: in-progress` no cabeçalho (etapa longa, interrompida) |
| `invalid` | a saída existe, mas não segue o contrato: cabeçalho ausente ou diferente do `flow.yaml`, ou (etapas com `on_reject`) sem a linha `**Veredito:**` |
| `rejected` | a saída tem `**Veredito:** reprovado`: as etapas seguintes ficam bloqueadas e o JSON traz `redo`, a etapa a refazer |
| `ready` | não tem saída, mas tem todas as entradas |
| `blocked` | falta entrada, ou a etapa que a produz não está pronta (em andamento, inválida ou reprovada) |

Consequência prática: **editou o PRD à mão? A arquitetura, a implementação, a verificação, a revisão e a entrega ficam `stale`.** O maestro avisa e pergunta se você quer refazer.

## 5. O maestro (`run-pipeline`)

A skill [`run-pipeline`](../skills/run-pipeline/SKILL.md) faz o loop:

```
┌─► npm --prefix pipeline run status -- --json ──► next == null? ──► fim (mostra o último artefato)
│              │
│              ▼
│   lê a etapa no flow.yaml (skill, inputs, outputs, adapter)
│              │
│              ▼
│   lê os inputs ──► chama a skill (+ adapter) ──► confere os outputs ──► npm --prefix pipeline run guard
│              │
└── usuário diz "continua" ◄── para e reporta (reprovado? volta para implement)
```

Ela **pergunta ao script** em vez de deduzir sozinha. LLMs são bons em seguir instruções e ruins em contar arquivos e comparar datas com precisão. O script faz a parte determinística e a skill faz a parte de julgamento.

## 6. Adapters: encaixando skills de terceiros

`grilling` e `tdd` foram escritas para qualquer projeto. Elas não sabem que aqui existe `docs/flow/02-decisoes.md`. O **adapter** é um arquivo de instruções extras que o maestro passa junto com a skill:

- **antes**: de onde ler (`01-ideia.md`) e em que focar;
- **depois**: onde gravar e em que formato (`02-decisoes.md` com o cabeçalho do contrato).

Assim você usa a skill externa **sem editá-la**. Quando o autor publicar uma versão nova, é só rodar `npx skills update`, e o encaixe continua no seu adapter.

## 7. Onde cada coisa fica instalada

```
pipeline/skills/write-prd/   ← você edita aqui (fonte)
        │  npm --prefix pipeline run setup  (npx skills add ./pipeline ...)
        ▼
.agents/skills/write-prd/    ← cópia que Codex, Cursor, Gemini CLI... leem
.claude/skills/write-prd/    ← link para a cópia acima, que o Claude Code lê
```

As skills externas fazem o mesmo caminho, só que a fonte é o GitHub. O `pipeline/skills-lock.json` registra o hash de cada uma para você saber exatamente qual versão rodou.

## 8. Skills de apoio (`helpers`)

Nem toda skill é uma etapa. As listadas em `helpers:` no `flow.yaml` não têm ordem nem artefato próprio: etapas as chamam, ou você as chama direto.

| Skill | Quando |
|-------|--------|
| [`investigate`](../skills/investigate/SKILL.md) | algo falhou: reproduz e lê o código antes de afirmar a causa |
| [`harden`](../skills/harden/SKILL.md) | depois das entregas: transforma o "Trabalho manual" em regras duras |
| [`eval-skill`](../skills/eval-skill/SKILL.md) | para testar uma skill com casos de `pipeline/evals/` e nota |

O `validate` confere se elas existem e não as acusa como "não usadas". Por que elas existem está em [Confiar nos agentes](confiar-nos-agentes.md).
