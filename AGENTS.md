<!-- pipeline:start -->
# Pipeline de skills

Este repositório usa um **pipeline de skills**: uma ideia passa por etapas definidas em `pipeline/flow.yaml`, e cada etapa é uma skill.

## Base × produto

| | O que é | Onde fica |
|---|---|---|
| **Base** (o pipeline) | skills, scripts, testes, regras, guias | `pipeline/` (e este bloco do `AGENTS.md`) |
| **Produto** (o que uma execução gera) | artefatos de cada etapa | `docs/flow/` (atual) e `docs/runs/` (arquivadas) |
| | o código do projeto | a pasta `code` do `pipeline/flow.yaml` |

- Trabalho de uma execução vai **só** no produto. Nunca grave artefato, prova ou mapa dentro de `pipeline/`, nem arquivo do pipeline dentro do código do projeto.
- Para saber onde fica o código, leia `code` em `npm --prefix pipeline run --silent status -- --json` (`workspace` num projeto novo, `.` num projeto que já existia).
- `pipeline/FEATURE-MAP.md` é o mapa da base: cada comando e skill, o código e o teste. Comece por ele para mexer no pipeline.

## Quando o usuário pedir para rodar, continuar ou retomar o pipeline

Use a skill **`run-pipeline`**. Ela lê `npm --prefix pipeline run --silent status -- --json` para saber a próxima etapa. Não pule etapas e não decida a ordem por conta própria.

Num projeto que já existia (`code` diferente de `workspace`), a primeira coisa é a skill **`onboard`**: ela escreve o `docs/FEATURE-MAP.md` do código e procura skills para a stack com a `find-skills`. O `status` bloqueia as etapas até isso estar feito. Antes de mexer no código, comece pelo `docs/FEATURE-MAP.md`.

Se o usuário descrever uma ideia nova sem mencionar o pipeline, pergunte se ele quer rodá-lo.

## Regras

- Os comandos do pipeline rodam com `npm --prefix pipeline run <comando>`, de qualquer pasta do repositório.
- As etapas se comunicam **só por arquivos** em `docs/flow/`. Formato: `pipeline/skills/run-pipeline/references/contrato-dos-artefatos.md`. O `status` confere o cabeçalho e o veredito de cada artefato: etapa `invalid` ou `rejected` não deixa a seguinte rodar.
- Durante uma execução, não edite a base (`pipeline/`, `AGENTS.md`, `CLAUDE.md`): `npm --prefix pipeline run guard` falha se isso acontecer.
- **Regras duras valem mais que instruções.** O que precisa ser garantido vira script, teste ou checagem (`guard`, `validate`, testes, pre-commit); skill é para julgamento. Ao propor uma regra nova, prefira a que faz algo falhar. Veja `pipeline/guias/confiar-nos-agentes.md`.
- **Prova é comando + saída.** Não diga que algo funciona sem ter rodado.
- Quando algo falhar, use a skill `investigate`: reproduzir e ler o código antes de afirmar a causa. As skills de apoio (`helpers` no `flow.yaml`) não são etapas.
- Ao mudar `pipeline/flow.yaml`, `pipeline/skills/` ou `pipeline/skills.json`: rode `npm --prefix pipeline run validate`, depois `npm --prefix pipeline run setup` (as skills são **copiadas** para `.claude/skills/` e `.agents/skills/`) e `npm --prefix pipeline run diagram -- --write`.
- Antes de concluir mudanças no pipeline: `npm --prefix pipeline run check` (typecheck + testes + validate + guard). Atualize o `pipeline/FEATURE-MAP.md` quando um comando ou uma skill mudar (um teste falha se faltar).
- Scripts em TypeScript executado direto pelo Node (≥ 22.18): imports com extensão `.ts`, sem `enum` nem `namespace` (`erasableSyntaxOnly`).
- Não faça commit nem push: o dono do repositório faz isso.
<!-- pipeline:end -->
