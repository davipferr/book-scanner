---
name: plan-architecture
description: A partir do PRD, define a arquitetura mínima e quebra o trabalho em fatias verticais com as interfaces públicas a testar (docs/flow/04-arquitetura.md). Use quando o usuário pedir arquitetura, plano técnico ou divisão em tarefas de um PRD, ou quando o run-pipeline estiver na etapa "architecture".
---

# Planejar a arquitetura

**Entrada:** `docs/flow/03-prd.md`
**Saída:** `docs/flow/04-arquitetura.md`

A próxima etapa usa a skill `tdd`, que trabalha em **fatias verticais** (um teste → uma implementação) e só testa em **interfaces públicas combinadas antes**. Este documento entrega exatamente isso: as interfaces e a ordem das fatias.

## Passos

1. Leia o PRD inteiro. Se houver item em "Em aberto" marcado como bloqueante, pare e peça a decisão ao usuário.
2. Escolha a **menor** arquitetura que atende os critérios de aceite. Respeite as "Restrições técnicas" do PRD. Não adicione camada, banco ou framework que nenhum CA exige.
3. Defina os **módulos** (nome, responsabilidade em uma frase, interface pública). Poucos módulos, com bastante coisa escondida atrás de uma interface pequena.
4. Defina as **interfaces a testar**: onde os testes observam o comportamento. Para cada uma: o que o teste pega e o que deixa passar.
5. Defina as **proibições**: o que, se um agente fizer por pressa, estraga o projeto. Agentes pegam o caminho mais curto; a arquitetura deve fazer o caminho mais curto ser o certo. Exemplos: "o módulo `core` não importa nada de `cli`", "nenhum acesso a disco fora de `io.ts`", "sem dependência nova sem motivo no PRD". Para cada proibição, diga **como ela é imposta automaticamente** (um teste que falha, uma regra de lint, um script). Proibição sem imposição não entra: vira só conselho, e conselho o agente esquece. Prefira poucas proibições que importam a muitas genéricas.
6. Quebre em **fatias**. Cada fatia:
   - cobre um ou mais CAs do PRD (cite os ids),
   - atravessa todas as camadas necessárias (não "fazer todo o banco primeiro"),
   - termina com algo que roda.
7. Escreva `docs/flow/04-arquitetura.md` a partir de [template.md](template.md), com o cabeçalho:

   ```yaml
   step: architecture
   skill: plan-architecture
   inputs: [docs/flow/03-prd.md]
   ```

8. Confira a cobertura: todo `CA-n` do PRD aparece em pelo menos uma fatia. Se algum ficou de fora, explique em "Em aberto".

## Onde fica o código

O código da feature vai na pasta do código (`code` em `npm --prefix pipeline run --silent status -- --json`: `workspace` num projeto novo, `.` num projeto que já existia). Ele é produto da execução, não parte do pipeline: nada dele fica em `pipeline/`. Diga na seção "Estrutura" como a pasta do código vai ficar organizada (num projeto que já existia, siga a organização que ele já tem).

Organize por **funcionalidade**, não por tipo de arquivo: tudo de uma funcionalidade junto, numa pasta. Assim o agente que mexer nela acha tudo num lugar só e não espalha mudanças. A pasta do código precisa funcionar sozinha (sem herdar configuração da pasta de cima): a etapa `verify` roda uma cópia dela fora do repositório.
