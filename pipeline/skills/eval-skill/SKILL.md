---
name: eval-skill
description: Testa uma skill como se fosse código. Roda os casos de pipeline/evals/<skill>/ num agente sem contexto, dá nota pelos critérios de cada caso e, se a nota ficar abaixo do mínimo, propõe e testa melhorias no SKILL.md até passar. Funciona com qualquer agente. Use quando o usuário pedir para avaliar, testar ou melhorar uma skill, ou depois de mudar um SKILL.md para saber se ele ficou melhor ou pior.
---

# Avaliar uma skill

Uma skill é código: muda, e pode piorar sem ninguém perceber. Esta skill faz o papel de teste unitário. Um agente sem contexto executa a skill num caso conhecido, e um juiz dá nota pelos critérios do caso.

O formato dos casos está em `pipeline/evals/README.md`.

## Passos

1. **Escolha a skill e os casos.** Liste `pipeline/evals/<skill>/`. Se não houver caso, ajude o usuário a escrever um (veja o README) antes de seguir: sem caso, não há o que medir.

2. **Prepare uma pasta disfarçada para cada caso.** Crie uma pasta temporária **fora deste repositório**, com nome neutro (ex.: `projeto-7f3a`, nunca "eval" ou "teste"). Agentes mudam de comportamento quando sabem que estão sendo avaliados. Copie para ela:
   - o conteúdo de `pipeline/evals/<skill>/<caso>/arquivos/`;
   - a skill avaliada, de `pipeline/skills/<skill>/`, para `.agents/skills/<skill>/` e `.claude/skills/<skill>/` dentro da pasta.

   **Não copie o `caso.md`**: o executor não pode ver os critérios.

3. **Execute com um agente sem contexto.** Quem executa não pode ser você: você já leu os critérios. Use, nesta ordem de preferência:
   - um subagente da sua ferramenta, trabalhando na pasta disfarçada, com só o "Pedido" do caso como prompt;
   - o modo não interativo de um agente pela linha de comando, rodado na pasta (ex.: `claude -p "<pedido>"`, `codex exec "<pedido>"`, `gemini -p "<pedido>"`), se o usuário tiver algum instalado;
   - o usuário: peça que abra uma sessão nova do agente que preferir na pasta e cole o pedido.

   Anote qual agente e qual modelo executaram.

4. **Julgue.** Para cada critério do caso, dê uma nota de 0 a 10 e justifique citando um trecho do que o executor produziu. Sem trecho, nota 0. A nota do caso é a média ponderada pelos pesos. Se der, julgue com um agente ou modelo **diferente** do executor e diga qual foi.

5. **Suba a nota, se precisar** (no máximo 3 rodadas):
   - Para cada critério abaixo do mínimo, proponha a **menor** mudança no `SKILL.md` que o resolveria. A mudança tem que ser geral: nunca cite o caso nem os dados dele, senão você ensina a skill a passar no teste, e não a fazer o trabalho.
   - Mostre a mudança e espere a aprovação do usuário (ela mexe em `pipeline/skills/`; durante uma execução do pipeline, o `npm --prefix pipeline run guard` barra).
   - Aplique, rode `npm --prefix pipeline run setup` e volte ao passo 2 com **todos** os casos da skill, não só o que falhou: melhorar um caso pode piorar outro.

6. **Resuma na conversa**, sem gravar arquivo de resultado: para cada caso, o executor e o juiz (agente e modelo), a nota por critério com o trecho que a justifica, a nota final e o mínimo; depois, as notas antes e depois de cada rodada, o que mudou no `SKILL.md` e o que continua abaixo do mínimo. O histórico fica no git: os casos em `pipeline/evals/` e as mudanças em `pipeline/skills/`.

## Regras

- Apague as pastas temporárias no fim.
- Um caso que sempre tira 10 não mede mais nada: sugira um caso mais difícil.
- Nota dada pelo próprio executor vale menos. Diga isso no resumo quando acontecer.
- Não grave nada em `pipeline/evals/` além de casos novos que o usuário aprovar.
