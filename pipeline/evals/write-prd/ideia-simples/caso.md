# Ideia simples com decisões já tomadas

A ideia e as decisões de um contador de palavras. Mede se o PRD sai testável e fiel às decisões, sem inventar escopo.

## Pedido
Escreva o PRD desta ideia a partir de docs/flow/01-ideia.md e docs/flow/02-decisoes.md, gravando em docs/flow/03-prd.md.

## Critérios
| # | Critério | Peso |
|---|----------|------|
| 1 | O arquivo `docs/flow/03-prd.md` existe e começa com o cabeçalho `step: prd`, `skill: write-prd` e os dois `inputs`. | 1 |
| 2 | Todo critério de aceite (`CA-n`) tem um exemplo concreto de entrada e o resultado esperado, verificável por um teste automático. | 3 |
| 3 | Toda decisão de `02-decisoes.md` aparece no PRD (como requisito, restrição ou "fora de escopo"), sem contradição. | 2 |
| 4 | Não há requisito que não venha da ideia ou das decisões. Suposições estão marcadas como tal ou em "Em aberto". | 2 |
| 5 | Existe uma seção "Fora de escopo" com pelo menos dois itens. | 1 |

## Nota mínima
8
