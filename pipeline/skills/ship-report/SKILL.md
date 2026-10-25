---
name: ship-report
description: Fecha uma execução do pipeline escrevendo docs/flow/08-entrega.md, um resumo para quem não acompanhou, com o que foi entregue, como rodar, decisões, pendências e o que ainda precisou de mão humana. Use quando o usuário pedir o resumo final ou o relatório de entrega, ou quando o run-pipeline estiver na etapa "ship".
---

# Relatório de entrega

**Entradas:** `docs/flow/03-prd.md`, `docs/flow/06-verificacao.md`, `docs/flow/07-revisao.md`
**Saída:** `docs/flow/08-entrega.md`

Este é o único artefato que alguém de fora vai ler. Escreva para uma pessoa que não viu nenhuma das etapas anteriores e tem dois minutos.

## Passos

1. Leia a revisão. Se o veredito for **reprovado**, pare: diga ao usuário que a entrega só sai depois que a revisão aprovar, e qual etapa refazer.
2. Leia o PRD para o objetivo e os critérios de aceite, e a verificação para o que não deu para verificar.
3. **Pergunte ao usuário** (uma pergunta só, e espere): "Nesta execução você precisou fazer algo à mão? Corrigir código, rodar o programa para testar, explicar de novo algo que já estava num artefato, consertar uma configuração?" Junte a resposta com o "Não verificado" de `06-verificacao.md`.
4. Escreva `docs/flow/08-entrega.md` a partir de [template.md](template.md):
   - **Em uma frase**: o que a pessoa ganha.
   - **Como rodar**: comandos copiáveis, testados por você agora.
   - **Decisões que importam**: no máximo 5, com um link para o artefato onde foram tomadas.
   - **Pendências**: tudo o que ficou "Em aberto" em qualquer artefato e ainda vale.
   - **Trabalho manual**: cada coisa que um humano precisou fazer (da pergunta acima) ou que ficou sem verificar. Para cada uma, uma linha com **que regra dura evitaria isso** (um teste, uma checagem, uma skill nova, um passo a mais numa skill existente). É daqui que a skill `harden` tira o que endurecer. Se não houve nada, escreva "nenhum".
   - **Trilha**: a lista dos artefatos de `docs/flow/`, um por linha, para quem quiser se aprofundar.
5. Cabeçalho:

   ```yaml
   step: ship
   skill: ship-report
   inputs: [docs/flow/03-prd.md, docs/flow/06-verificacao.md, docs/flow/07-revisao.md]
   ```

6. Termine sugerindo `npm --prefix pipeline run archive` para guardar a execução em `docs/runs/` e liberar `docs/flow/` para a próxima ideia.
