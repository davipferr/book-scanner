---
name: capture-idea
description: Registra uma ideia de feature ou produto em docs/flow/01-ideia.md, a primeira etapa do pipeline. Use quando o usuário descrever uma ideia nova ("quero fazer...", "tenho uma ideia de...") ou quando o run-pipeline estiver na etapa "idea".
---

# Capturar a ideia

**Entrada:** a mensagem do usuário (nenhum arquivo).
**Saída:** `docs/flow/01-ideia.md`

Seu trabalho é **registrar**, não projetar. Escreva o que o usuário disse de forma organizada e deixe as decisões para a próxima etapa (o interrogatório). Não proponha arquitetura, stack ou telas.

## Passos

1. Se `docs/flow/01-ideia.md` já existir, pare e pergunte se o usuário quer substituí-lo (ou rodar `npm --prefix pipeline run archive` antes).
2. Releia a mensagem do usuário e separe:
   - **o problema** (o que dói hoje e para quem),
   - **a ideia** (o que ele imagina fazer),
   - **restrições** que ele já deu (prazo, linguagem, onde vai rodar),
   - **dúvidas** que ficaram óbvias para você.
3. Se faltar o problema ou o público, faça **no máximo duas** perguntas curtas. Todo o resto é trabalho da próxima etapa.
4. Escreva `docs/flow/01-ideia.md` a partir de [template.md](template.md), com o cabeçalho do contrato:

   ```yaml
   step: idea
   skill: capture-idea
   inputs: []
   ```

5. Mostre o arquivo em poucas linhas e diga que a próxima etapa é o interrogatório (skill `grilling`).

## Bom e ruim

- Bom: "Problema: eu esqueço quanto gastei no mês até a fatura chegar."
- Ruim: "Problema: falta de um app React com Postgres para finanças." (isso já é solução)
