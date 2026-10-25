# Adapter: `grilling` na etapa "grill"

A skill `grilling` (de mattpocock/skills) faz um interrogatório até chegar a um entendimento comum, mas não sabe nada sobre os arquivos deste projeto. Este adapter diz de onde ela parte e onde o resultado vai parar.

## Antes de chamar a skill

- Leia `docs/flow/01-ideia.md`. O "plano" a ser interrogado é essa ideia.
- Comece pelas dúvidas da seção "Em aberto". Elas já são a primeira rodada natural.
- Mantenha o foco em decisões de **produto e escopo** (o quê, para quem, o que fica de fora, restrições). Decisões de módulos e código ficam para a etapa de arquitetura.

## Depois que a skill terminar

Quando o usuário confirmar que vocês chegaram a um entendimento comum, grave `docs/flow/02-decisoes.md`:

```markdown
---
step: grill
skill: grilling
inputs:
  - docs/flow/01-ideia.md
---

# Decisões: <nome da ideia>

## Decisões
| # | Pergunta | Decisão | Por quê |
|---|----------|---------|---------|
| 1 | <pergunta> | <resposta final> | <motivo em poucas palavras> |

## Fora de escopo (decidido)
- <...>

## Em aberto
- <o que o usuário preferiu não decidir agora>
```

Registre só respostas **finais**. Se o usuário mudou de ideia no meio, fica a última versão.
