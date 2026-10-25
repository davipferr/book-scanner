---
name: harden
description: Transforma o trabalho manual registrado nas entregas do pipeline (o que um humano precisou corrigir, testar ou explicar) em regras duras, como testes, checagens e passos de skill, para que não se repita. Use quando o usuário pedir para "endurecer", aprender com as execuções ou reduzir o que ele precisa fazer à mão, ou quando o run-pipeline terminar com "Trabalho manual" não vazio.
---

# Endurecer a partir do trabalho manual

Cada vez que uma pessoa precisou fazer algo à mão numa execução, o pipeline tem um buraco. Revisar código linha a linha, rodar o programa para ver se funciona, consertar uma configuração: tudo isso é o humano virando gargalo. Esta skill fecha esses buracos com **regras duras**, que valem para qualquer agente, em vez de pedir "tome mais cuidado" num prompt.

**Entradas:** a seção "Trabalho manual" de `docs/flow/08-entrega.md` e de `docs/runs/*/08-entrega.md`
**Saída:** `pipeline/endurecimento.md` (o registro de cada lição e da regra que a fecha) e, com aprovação do usuário, as mudanças propostas

## A hierarquia das regras

Da mais forte para a mais fraca. Sempre proponha a mais forte que resolve:

1. **Estrutura**: o erro fica impossível (ex.: um módulo que não tem como acessar o disco).
2. **Checagem automática**: o erro faz algo falhar (um teste, o `npm --prefix pipeline run validate`, o `npm --prefix pipeline run guard`, um lint, o pre-commit).
3. **Passo de skill**: uma etapa passa a fazer algo que não fazia (ex.: a `verify` passou a rodar uma cópia fora do repositório).
4. **Instrução**: uma frase num SKILL.md ou no AGENTS.md. Só quando nada acima cabe; diga por quê.

## Passos

1. **Junte as lições.** Leia as seções "Trabalho manual" de todas as entregas (a atual e as arquivadas). Leia `pipeline/endurecimento.md`, se existir, e ignore o que já foi resolvido.
2. **Agrupe** o que tem a mesma causa. Uma lição que apareceu em várias execuções vem primeiro.
3. **Para cada grupo, entenda a causa** antes de propor (use a skill `investigate` se for um defeito): por que o agente não pegou isso sozinho? Faltou informação, faltou uma checagem, ou a skill mandava fazer outra coisa?
4. **Proponha a regra** no nível mais forte possível da hierarquia, dizendo o arquivo que muda e como saber que funcionou (ex.: "o teste novo falha no código da execução X e passa no corrigido").
5. **Mostre as propostas ao usuário e espere a aprovação.** Elas mexem em `pipeline/` (skills, scripts, testes, adapters, `flow.yaml`), que é do dono do projeto. Se houver execução em andamento, o `npm --prefix pipeline run guard` vai barrar: proponha fazer depois do `npm --prefix pipeline run archive`.
6. **Aplique o que foi aprovado** e feche o ciclo: `npm --prefix pipeline run check`, `npm --prefix pipeline run setup` e, se o `pipeline/flow.yaml` mudou, `npm --prefix pipeline run diagram -- --write`. Para mudança em skill, considere um caso novo em `evals/` (skill `eval-skill`) que reproduza a lição.
7. **Registre** em `pipeline/endurecimento.md`, uma linha por lição. Ele é parte do pipeline (as regras e o porquê de cada uma), não de uma execução:

   ```markdown
   | Lição (execução) | Causa | Regra | Nível | Arquivo | Estado |
   |------------------|-------|-------|-------|---------|--------|
   | tsconfig herdava da pasta de cima (2026-10-17 flashcards) | verify rodava dentro do repositório | verify roda numa cópia fora | 3 | pipeline/skills/verify/SKILL.md | aplicada |
   ```

## Regras

- Uma regra por causa, não por sintoma. Três lições com a mesma causa viram uma regra.
- Não proponha regra que um agente só cumpre "prestando atenção". Se a proposta é uma frase, pergunte-se primeiro qual teste ou checagem faria o mesmo.
- Regra que deixa tudo mais lento ou mais chato para o dono também é um custo: diga qual é.
