---
step: review
skill: review-against-prd
inputs:
  - docs/flow/03-prd.md
  - docs/flow/04-arquitetura.md
  - docs/flow/05-implementacao.md
  - docs/flow/06-verificacao.md
---

# Revisão: <nome da feature>

**Veredito:** aprovado | reprovado

## Testes e verificação repetida
```
<comandos rodados (testes e "Como repetir" da verificação) e o resumo da saída>
```

## Critérios de aceite
| CA | Veredito | Evidência |
|----|----------|-----------|
| CA-1 | ✅ | `<pasta do código>/test/x.test.ts` › "nome do teste" · verificação: "<funcionalidade>" |

## Arquitetura
- <bate com 04-arquitetura.md? desvios e se estão justificados>
- Proibições: <cada uma com a checagem que a impõe e se está passando>

## Escopo extra
- <nada, ou o que foi feito além do PRD>

## O que corrigir (se reprovado)
1. <etapa a refazer> — <o que mudar>
