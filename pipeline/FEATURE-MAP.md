# Mapa de funcionalidades: o pipeline (base)

O mapa da base: cada comando e cada skill, onde estão no código e qual teste os cobre. Um agente que for mexer no pipeline começa por aqui, em vez de adivinhar. Caminhos a partir de `pipeline/`. Atualize este arquivo sempre que um comando ou uma skill mudar (`test/feature-map.test.ts` falha se faltar algum).

O mapa de cada **projeto gerado** não fica aqui: ele é uma seção do `docs/flow/05-implementacao.md` daquela execução. Num projeto que **já existia**, o mapa do código fica em `docs/FEATURE-MAP.md` daquele projeto (skill `onboard`).

## Instalar e rodar
- Requisitos: Node.js ≥ 22.18 (os scripts são TypeScript rodando direto no Node, sem build)
- Instalar: `npm --prefix pipeline install` e `npm --prefix pipeline run setup`
- Conferir tudo: `npm --prefix pipeline run check` (typecheck + testes + validate + guard); o pre-commit roda o mesmo
- Rodar o pipeline: abrir o agente na raiz do repositório e pedir "rode o pipeline" (skill `run-pipeline`)
- Os comandos rodam de qualquer pasta do repositório: `lib/files.ts` › `REPO_ROOT` acha a raiz pela localização dos scripts, e `userPath` resolve caminhos digitados a partir da pasta de onde o comando foi chamado

## Funcionalidades
| Funcionalidade | Como acionar | Código | Teste |
|----------------|--------------|--------|-------|
| Estado do pipeline | `npm --prefix pipeline run status [-- --json] [-- --dir <pasta>] [-- --ignore-time]` | `scripts/status.ts` › `lib/status.ts` › `computeStatus`; `lib/files.ts` › `flattenProbe` (execuções arquivadas) | `test/status.test.ts`, `test/tooling.test.ts` › "flattenProbe" |
| Conferir o contrato dos artefatos (cabeçalho `step`/`skill`/`inputs`) | automático no `status`: fora do contrato, a etapa fica `invalid` e a seguinte, bloqueada | `lib/status.ts` › `contractProblems` | `test/status.test.ts` › "contrato dos artefatos" |
| Travar o fluxo quando uma etapa reprova | automático no `status`, para etapas com `on_reject` no `flow.yaml`: `**Veredito:** reprovado` deixa a etapa `rejected`, com `redo` no JSON | `lib/status.ts` › `verdictOf`; `lib/flow.ts` › `onReject`; `lib/validate.ts` (on_reject só volta no fluxo) | `test/status.test.ts` › "veredito", `test/validate.test.ts` › "on_reject" |
| Validar o fluxo | `npm --prefix pipeline run validate [-- --strict]` | `scripts/validate.ts` › `lib/validate.ts` › `validateProject`; `lib/flow.ts` › `parseFlow` | `test/validate.test.ts`, `test/project.test.ts` |
| Separar base e produto | automático no `validate`: artefato fora de `docs/flow/`, adapter fora de `pipeline/` ou `code` dentro de `pipeline/`/`docs/` é erro | `lib/files.ts` › `PIPELINE_DIR`, `FLOW_DIR`, `RUNS_DIR`; `lib/validate.ts`; `lib/flow.ts` › `code` | `test/validate.test.ts` › "base × produto", "code" |
| Pasta do código do projeto | `code` no `flow.yaml` (`workspace` ou `.`); aparece em `status -- --json` | `lib/flow.ts` › `parseFlow`; `lib/status.ts`; `scripts/archive.ts` | `test/validate.test.ts` › "code" |
| Barrar mudança na base durante uma execução | `npm --prefix pipeline run guard` | `scripts/guard.ts` › `lib/guard.ts` › `activeRun`, `unapprovedEdits`, `PIPELINE_PATHS` (`pipeline/`, `AGENTS.md`, `CLAUDE.md`) | `test/guard.test.ts` |
| Instalar as skills e ligar o pre-commit | `npm --prefix pipeline run setup [-- --dry-run] [-- --local-only]` | `scripts/install.ts` › `lib/skills.ts` › `installCommands` | `test/tooling.test.ts` › "installCommands" |
| Criar uma skill | `npm --prefix pipeline run new-skill -- <nome> "<descrição>"` | `scripts/new-skill.ts` | — |
| Diagrama do fluxo no README | `npm --prefix pipeline run diagram [-- --write]` | `scripts/diagram.ts` › `lib/diagram.ts` › `toMermaid`, `replaceDiagram` | `test/tooling.test.ts` › "diagrama" |
| Arquivar uma execução | `npm --prefix pipeline run archive [-- --dry-run]` | `scripts/archive.ts` | — |
| Levar a base para outro projeto (ou atualizá-la lá) | `npm --prefix pipeline run adopt -- <pasta> [--update] [--code <pasta>] [--dry-run] [--skip-install]` | `scripts/adopt.ts` › `lib/adopt.ts` › `copyPlan`, `upsertBlock`, `externalFromLock`, `mergeExternal` | `test/adopt.test.ts` (inclui o script de verdade numa pasta temporária) |
| Exigir o onboard num projeto que já existia | automático no `validate` (erro) e no `status` (todas as etapas `blocked`, `onboard` no JSON) quando `code` não é `workspace` e falta o `docs/FEATURE-MAP.md` com as seções certas | `lib/onboard.ts` › `onboardProblems`, `PROJECT_MAP`; `lib/validate.ts`; `lib/status.ts` | `test/validate.test.ts` › "onboard", `test/status.test.ts` › "onboard pendente" |
| Checagem completa | `npm --prefix pipeline run check` (o hook `githooks/pre-commit` roda `npm --prefix pipeline run precommit`, que chama este) | `package.json`, `githooks/pre-commit` | `test/guard.test.ts` › "a cadeia de checagens" |
| Typecheck | `npm --prefix pipeline run typecheck` | `tsconfig.json` | — |
| Testes | `npm --prefix pipeline test` | `test/` | `test/feature-map.test.ts` (este mapa), `test/project.test.ts` › "instruções do pipeline" (os guias e skills só citam comandos que existem) |
| Orquestrar as etapas | pedir "rode o pipeline" | `skills/run-pipeline/SKILL.md` | — |
| Etapas do fluxo | o maestro chama uma por vez | `flow.yaml` › `steps`; externas encaixadas por `adapters/` | `test/project.test.ts` |
| 1. Capturar a ideia | etapa `idea` | `skills/capture-idea/` | `evals/` (sem caso ainda) |
| 3. PRD | etapa `prd` | `skills/write-prd/` | `evals/write-prd/` |
| 4. Arquitetura e fatias | etapa `architecture` | `skills/plan-architecture/` | — |
| 6. Verificação como usuário | etapa `verify` | `skills/verify/` | — |
| 7. Revisão contra o PRD | etapa `review` | `skills/review-against-prd/` | — |
| 8. Relatório de entrega | etapa `ship` | `skills/ship-report/` | — |
| 2. Interrogatório e 5. Implementação | etapas `grill` e `implement` (skills externas `grilling` e `tdd`) | `adapters/grilling.md`, `adapters/tdd.md` | — |
| Investigar uma falha | pedir "investigue ..." | `skills/investigate/SKILL.md` | — |
| Transformar trabalho manual em regra | pedir "endureça" | `skills/harden/SKILL.md`; registro em `endurecimento.md` | — |
| Avaliar uma skill | pedir "avalie a skill <nome>" | `skills/eval-skill/SKILL.md`, casos em `evals/` | — |
| Preparar um projeto que já existia (mapa do código + skills da stack com a `find-skills`) | pedir "faça o onboard do pipeline", ou o `status` pede | `skills/onboard/SKILL.md`, `skills/onboard/template.md`; `find-skills` vem de `vercel-labs/skills` no `skills.json` | o `validate` (acima) confere o resultado |

## Entradas e saídas
- Entrada do pipeline: a ideia, numa conversa com o agente.
- Produtos de cada execução (fora de `pipeline/`): os artefatos `docs/flow/01-ideia.md` … `08-entrega.md` (formato em `skills/run-pipeline/references/contrato-dos-artefatos.md`), arquivados em `docs/runs/`; e o código, na pasta `code` do `flow.yaml`.
- Skills instaladas: `.claude/skills/` e `.agents/skills/` na raiz do repositório (fora do git, recriadas pelo `setup`).

## Erros conhecidos
- `validate` com aviso "mudou desde o último setup" → rode `npm --prefix pipeline run setup` (as skills locais são **copiadas** para `.agents/skills/`).
- `guard` falhando → a base foi alterada durante uma execução: `git add` para manter, `git restore` para descartar, ou `npm --prefix pipeline run archive` antes de mexer.
- `status` com etapas `stale` logo depois de um `git clone` → as datas foram reescritas; use `-- --ignore-time`.
- `status` com etapa `fora do contrato` → o artefato não tem o cabeçalho certo ou (em `verify`/`review`) a linha `**Veredito:**`; refaça a etapa.
- `status` com etapa `reprovada` → volte para a etapa do `redo` (normalmente `implement`) com as falhas do artefato.
- `test/feature-map.test.ts` falhando → um comando, script ou skill novo não está neste mapa.
- `validate` com erro em `docs/FEATURE-MAP.md` (ou `status` com tudo bloqueado por "falta o onboard") → projeto que já existia sem o mapa do código: peça a skill `onboard`.
- `adopt` dizendo que `pipeline/` já existe → o projeto já adotou: use `--update`.
- `test/project.test.ts` › "instruções do pipeline" falhando → um guia ou skill cita um comando do pipeline sem `--prefix pipeline`, um comando que não existe ou um link quebrado.
