---
name: review-against-prd
description: Revisa a implementação (na pasta do código do projeto) contra os critérios de aceite do PRD, um por um, com os testes e as provas da verificação, e grava o veredito em docs/flow/07-revisao.md. Use quando o usuário pedir para revisar ou conferir se a implementação atende o PRD, ou quando o run-pipeline estiver na etapa "review".
---

# Revisar contra o PRD

**Entradas:** `docs/flow/03-prd.md`, `docs/flow/04-arquitetura.md`, `docs/flow/05-implementacao.md`, `docs/flow/06-verificacao.md`
**Saída:** `docs/flow/07-revisao.md`

Você é um revisor desconfiado. O registro da implementação diz o que foi feito; seu trabalho é **provar** se é verdade. Não confie no `05-implementacao.md` nem no `06-verificacao.md` sem rodar nada.

## Passos

1. Leia a verificação. Se o veredito dela for **reprovado**, pare: a revisão só roda depois que a verificação aprovar. Diga ao usuário para voltar à etapa `implement` com as "Falhas" de `06-verificacao.md`.
2. Leia o PRD e liste todos os critérios de aceite (`CA-n`).
3. Rode os testes da pasta do código (o `code` do `status -- --json`; o comando está em `05-implementacao.md`) **e** os comandos de "Como repetir" de `06-verificacao.md`. Guarde as saídas. Se algum não existir ou não der a saída esperada, isso já é bloqueante.
4. Para cada CA, dê um veredito:
   - **✅ atende**: aponte a prova: o teste (arquivo e nome) **e**, se o CA tem comportamento visível ao usuário, a linha da verificação que o exercitou.
   - **⚠️ parcial**: existe teste, mas ele não cobre o critério inteiro. Diga o que falta.
   - **❌ não atende**: não há teste, o teste falha, ou o comportamento contradiz o critério.
5. Confira a arquitetura: os módulos e as interfaces de `04-arquitetura.md` existem como planejado? Desvios não são erro por si só, mas precisam estar justificados em `05-implementacao.md`. Cada **proibição** precisa ter a checagem automática prometida, e ela precisa estar passando: proibição sem checagem é ❌.
6. Procure **escopo extra**: algo implementado que está no "Fora de escopo" do PRD.
7. Escreva `docs/flow/07-revisao.md` a partir de [template.md](template.md). O veredito geral é **aprovado** só se todos os CAs estiverem ✅.
8. Se reprovar, diga qual etapa refazer (normalmente a implementação) e o que corrigir. **Não corrija o código você mesmo**: esta etapa só revisa.
