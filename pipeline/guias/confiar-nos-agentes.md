# Confiar nos agentes (sem virar o gargalo)

O problema que este guia resolve: o agente escreve o código, **você** roda, quebra, **você** copia o erro, cola de volta, e repete. Os testes passam, a revisão aprova, e mesmo assim é você quem descobre que não funciona. Você virou o gargalo.

A saída não é um prompt melhor. É construir em volta dos agentes um ambiente onde:

1. **o agente verifica o próprio trabalho**, como um usuário, antes de te entregar;
2. **o que importa é garantido por regra dura** (script, teste, checagem), não por instrução;
3. **cada vez que você precisa fazer algo à mão, isso vira uma regra nova.**

Tudo aqui é local e funciona com qualquer agente que lê skills (Claude Code, Codex, Gemini CLI e outros) e com qualquer modelo. A ideia vem da apresentação de Lauren Tan sobre a "curva de confiança" em agentes; este repositório aplica só a parte local, na forma de skills e scripts.

## A divisão: skill faz, script garante

| | Skill | Script |
|---|---|---|
| Serve para | julgamento: usar o programa, investigar, escrever, decidir | o que tem que dar o mesmo resultado não importa quem rode |
| Quem roda | o agente (qualquer um) | o agente, você, o pre-commit |
| Exemplos | `verify`, `investigate`, `harden`, `eval-skill` | `npm --prefix pipeline run guard`, `npm --prefix pipeline run validate`, `npm --prefix pipeline run check`, os testes |

Se uma regra pode ser um script, ela é um script. Uma instrução num SKILL.md o agente pode esquecer; um script que falha, não.

## As peças

### 1. Verificação como usuário (etapa `verify`)

Testes provam que os testes passam. A etapa [`verify`](../skills/verify/SKILL.md) usa o programa de verdade:

- copia a pasta do código (`workspace/` num projeto novo) para **fora do repositório** e roda lá (pega o que só funciona por herança da pasta de cima, como um `tsconfig` com `extends: "../tsconfig.json"`);
- roda cada funcionalidade com entradas reais e procura bordas (vazio, CRLF, caminho com espaço, volume);
- guarda **comando + saída real** como prova em `docs/flow/06-verificacao.md`;
- deixa, no próprio artefato, os **comandos para repetir** a verificação, sem gravar nada no código do projeto.

Se reprovar, o maestro volta para a implementação com as falhas já escritas. Você não precisa reproduzir nada.

### 2. Mapa de funcionalidades (no `05-implementacao.md`)

Um agente não sabe operar o seu programa: que comando, que tela, que atalho, onde está o código. O mapa diz. A implementação o mantém, a verificação o usa, e qualquer pedido futuro ("tem um bug na exportação") começa por ele. A base tem o seu: o [`pipeline/FEATURE-MAP.md`](../FEATURE-MAP.md), com cada comando e skill, o código e o teste (um teste falha se ele ficar para trás). O de cada projeto gerado é uma seção do `docs/flow/05-implementacao.md` daquela execução, e não um arquivo dentro do código: o projeto gerado fica só com o código.

Num projeto que **já existia** (levado com o `adopt`), o código anterior também precisa de mapa. A skill [`onboard`](../skills/onboard/SKILL.md) escreve o `docs/FEATURE-MAP.md` do projeto, provando cada comando, e a etapa `implement` o mantém em dia. Isso não depende de alguém lembrar: enquanto o mapa não existir com as seções certas, o `validate` falha e o `status` bloqueia todas as etapas.

### 3. Parar de adivinhar (skill `investigate`)

O erro mais caro de um agente é afirmar uma causa que ele não verificou. A skill [`investigate`](../skills/investigate/SKILL.md) obriga a ordem: reproduzir → ler o código → hipótese com arquivo e linha → experimento que prova → teste vermelho. Sem reprodução, não há correção.

### 4. Arquitetura defensiva (proibições)

Agentes pegam o caminho mais curto. A etapa de arquitetura define **proibições** (ex.: "o núcleo não importa a CLI"), e cada uma precisa de uma **checagem automática** (um teste que falha). A revisão reprova proibição sem checagem. E o código é organizado por funcionalidade, para o caminho mais curto ser o certo.

### 5. Regras duras do próprio pipeline

- `npm --prefix pipeline run guard`: durante uma execução, falha se a base mudar sem você aprovar (`git add`): a pasta `pipeline/` inteira (skills, scripts, e também o que mantém as regras de pé: testes, hook, `package.json`), o `AGENTS.md` e o `CLAUDE.md`. Senão um agente poderia trocar o `check` por `echo ok` e nada falharia. O maestro roda depois de cada etapa. Como tudo da base está numa pasta só, o código do projeto nunca cai nessa proteção por engano.
- `npm --prefix pipeline run validate`: além de conferir o fluxo, separa base e produto (artefato só em `docs/flow/`, adapter só em `pipeline/`, código fora dos dois).
- `npm --prefix pipeline run status`: uma etapa só conta como pronta se o artefato segue o contrato (cabeçalho com `step`, `skill` e `inputs` iguais aos do `flow.yaml`). Nas etapas com `on_reject` (verificação e revisão), `**Veredito:** reprovado` trava as etapas seguintes e manda refazer a implementação: voltar não depende do maestro lembrar.
- `npm --prefix pipeline run check`: typecheck + testes + validate + guard. Testes também conferem que o `pipeline/FEATURE-MAP.md` cita cada comando, script e skill, e que guias e skills só citam comandos e links que existem.
- **pre-commit** (`pipeline/githooks/pre-commit`, ligado pelo `npm --prefix pipeline run setup`): roda `npm --prefix pipeline run precommit` antes de cada commit, venha ele de uma pessoa ou de um agente.

### 6. Fechar o ciclo (skill `harden`)

O relatório de entrega tem a seção **"Trabalho manual"**: o que você precisou fazer à mão ou ficou sem verificar, e que regra evitaria. A skill [`harden`](../skills/harden/SKILL.md) junta isso de todas as execuções e propõe a regra mais forte possível (estrutura > checagem > passo de skill > instrução), registrando em `pipeline/endurecimento.md` (é parte da base: as regras e o porquê de cada uma).

### 7. Testes para skills (skill `eval-skill` e `pipeline/evals/`)

Uma skill é código e pode piorar sem ninguém notar. A [`eval-skill`](../skills/eval-skill/SKILL.md) roda os casos de [`pipeline/evals/`](../evals/README.md) num agente sem contexto, numa pasta com nome neutro (agentes mudam quando sabem que estão sendo avaliados), dá nota pelos critérios e, se ficar abaixo do mínimo, propõe e testa melhorias. Executor e juiz podem ser agentes e modelos diferentes. Os casos ficam em arquivos, porque são o teste que se repete; as notas aparecem só na conversa.

## O hábito

Toda vez que você se pegar revisando linha a linha, rodando o programa para ver se funciona ou repetindo uma explicação, pergunte:

> Que teste, checagem ou passo de skill faria isso por mim?

Anote no "Trabalho manual" da entrega. A `harden` faz o resto.
