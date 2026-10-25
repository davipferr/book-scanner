---
name: write-prd
description: Transforma a ideia e as decisões do interrogatório num PRD curto (docs/flow/03-prd.md) com escopo, fora de escopo e critérios de aceite testáveis. Use quando o usuário pedir um PRD, especificação ou requisitos da ideia, ou quando o run-pipeline estiver na etapa "prd".
---

# Escrever o PRD

**Entradas:** `docs/flow/01-ideia.md`, `docs/flow/02-decisoes.md`
**Saída:** `docs/flow/03-prd.md`

O PRD é o contrato da feature. As etapas seguintes (arquitetura, implementação e revisão) vão ser julgadas contra ele, então cada critério de aceite precisa ser **verificável por um teste**.

## Passos

1. Leia as duas entradas. Se `02-decisoes.md` não existir, pare: a etapa de interrogatório não rodou.
2. Não reabra decisões que já estão em `02-decisoes.md`. Se encontrar uma contradição entre a ideia e as decisões, as **decisões vencem** (são mais recentes).
3. Escreva `docs/flow/03-prd.md` a partir de [template.md](template.md):
   - **Objetivo**: uma frase com o resultado para o usuário, não a tecnologia.
   - **Escopo**: o mínimo que resolve o problema. Prefira 3–6 itens.
   - **Fora de escopo**: tudo o que foi cogitado e ficou de fora. Isso evita que a implementação cresça sozinha.
   - **Critérios de aceite** numerados (`CA-1`, `CA-2`...), no formato *Dado / Quando / Então*. A etapa de revisão vai conferir um por um.
   - **Em aberto**: o que ainda não foi decidido. Se for algo que bloqueia a implementação, diga isso.
4. Cabeçalho do contrato:

   ```yaml
   step: prd
   skill: write-prd
   inputs: [docs/flow/01-ideia.md, docs/flow/02-decisoes.md]
   ```

## Teste do critério de aceite

Para cada CA, pergunte: "dá para escrever um teste automatizado que falha se isso não for verdade?". Se não dá, reescreva.

- Ruim: "CA-1: o sistema deve ser rápido."
- Bom: "CA-1: Dado um arquivo de 10 mil linhas, quando o comando roda, então termina em menos de 1 segundo."
