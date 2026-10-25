---
name: onboard
description: Prepara um projeto que já existia para o pipeline, uma vez, depois do adopt - escreve o docs/FEATURE-MAP.md do código que já existe (como instalar, rodar e acionar cada funcionalidade, onde está o código e o teste) e procura com a find-skills as skills do skills.sh que servem para a stack do projeto, registrando-as no pipeline/skills.json. Use quando o usuário pedir "faça o onboard", quando o status ou o validate disserem que falta o onboard, ou logo depois de um `adopt`.
---

# Onboard: preparar um projeto que já existia

O pipeline não roda num código que ele não conhece. Antes da primeira execução, esta skill dá ao projeto duas coisas que o `adopt` não consegue fazer sozinho, porque pedem julgamento:

1. **O mapa de funcionalidades** (`docs/FEATURE-MAP.md`): como instalar, rodar e acionar cada funcionalidade, e onde estão o código e o teste. Sem ele, a `verify`, a `investigate` e qualquer agente operam o programa no chute.
2. **As skills do projeto**: as do skills.sh que servem para a stack dele, achadas com a `find-skills` e registradas no `pipeline/skills.json`, para o `setup` reinstalar em qualquer máquina.

O `validate` falha e o `status` bloqueia todas as etapas até o mapa existir com as seções `## Instalar e rodar`, `## Funcionalidades` (com pelo menos uma linha) e `## Skills do projeto`. Não crie um mapa vazio só para passar: isso é exatamente o que a checagem existe para impedir.

**Entrada:** o código do projeto (`code` em `npm --prefix pipeline run --silent status -- --json`), o README, os manifestos (`package.json`, `*.csproj`, `pyproject.toml`, `go.mod`...), o `AGENTS.md`/`CLAUDE.md` do projeto e qualquer mapa que já exista (ex.: `docs/feature-map.md`, `SDK_MAP.md`).
**Saída:** `docs/FEATURE-MAP.md` (formato em [template.md](template.md)); `pipeline/skills.json` com as skills escolhidas; `pipeline/flow.yaml` com as skills do projeto em `helpers`, se houver.

Esta skill roda **antes** da primeira execução (sem nada em `docs/flow/`), por isso pode mexer no `pipeline/skills.json` e no `pipeline/flow.yaml`. Se já houver uma execução em andamento, pare: o `guard` vai acusar a mudança na base.

## Passos

### 1. Conheça o projeto

1. Rode `npm --prefix pipeline run --silent status -- --json` e anote `code`.
2. Leia o README, os manifestos e as instruções que o projeto já tinha. Liste a stack: linguagens, frameworks, banco, testes, build, como ele é entregue (CLI, API, app web, desktop, worker).
3. Se já existe um mapa (de outro formato), ele é a base: migre o conteúdo para o formato do template em vez de reescrever do zero, e diga ao usuário qual arquivo antigo pode ser apagado (não apague você).

### 2. Escreva o mapa, provando cada comando

1. Copie [template.md](template.md) para `docs/FEATURE-MAP.md`.
2. **Instalar e rodar:** rode de verdade cada comando que for escrever (instalar, testes, build, rodar). Comando que você não rodou não entra; se não deu para rodar (falta um serviço, uma chave), escreva o comando e, ao lado, "não verificado: <motivo>". Prova é comando + saída.
3. **Funcionalidades:** uma linha por coisa que um usuário consegue fazer, com o caminho exato para acionar (comando, rota, tela → clique, atalho, seletor), o arquivo e a função de entrada, e o teste que a cobre (ou "—"). Abra o código para preencher; não deduza pelo nome do arquivo.
4. **Entradas e saídas** e **Erros conhecidos:** variáveis de ambiente, portas, arquivos que lê e grava, mensagens e códigos de saída que você viu.

### 3. Procure skills para o projeto com a find-skills

1. Use a skill `find-skills` (instalada pelo `setup`, de `vercel-labs/skills`). Faça uma busca por item relevante da stack e por tipo de trabalho do projeto, por exemplo:

   ```bash
   npx skills find react performance
   ```

   ```bash
   npx skills find ef core
   ```

2. Para cada candidata: confira a fonte e o número de instalações e **leia o `SKILL.md` no GitHub** (ela vai rodar com as permissões do agente). Descarte as que repetem uma etapa do pipeline (`tdd`, `verify`, `investigate`...) ou que têm `disable-model-invocation: true`.
3. **Pergunte ao usuário** quais entram, mostrando para cada uma: nome, fonte, instalações, para quê neste projeto. Não instale nada sem a resposta.
4. Registre as aprovadas no `pipeline/skills.json`, no `external`, com um `why` curto. **Não** use o `npx skills add ... -g` que a `find-skills` sugere: instalação global não é reproduzível. Quem instala é o `setup`.
5. Skills que já estavam no projeto:
   - as do skills.sh (que estavam no `skills-lock.json` da raiz) o `adopt` já pôs no `skills.json`: confira se ainda fazem sentido e pergunte ao usuário sobre as que parecerem redundantes com o pipeline;
   - as soltas em `.claude/skills/` ou `.agents/skills/` (o `adopt` lista quais), escritas para este projeto: proponha movê-las para `pipeline/skills/<nome>/` e colocá-las em `helpers` no `pipeline/flow.yaml`, para o `setup` reinstalá-las. Só mova com o OK do usuário.
6. Escreva a seção `## Skills do projeto` do mapa: uma linha por skill (do pipeline não precisa), com fonte, quando usar e as buscas feitas. Se nenhuma servir, escreva as buscas e "nenhuma escolhida", para ficar claro que a busca aconteceu.

### 4. Instale e confira

```bash
npm --prefix pipeline run setup
```

```bash
npm --prefix pipeline run check
```

Mostre a saída. O `check` tem que passar sem o erro do `docs/FEATURE-MAP.md`, e o `status` tem que mostrar a primeira etapa como "pode rodar".

### 5. Reporte

Em poucas linhas: o que o mapa cobre (e o que ficou "não verificado"), as skills adicionadas e as recusadas, e o próximo passo: "rode o pipeline" com a primeira ideia.

## Regras

- Não mude o código do projeto. Se um comando do README não funciona, registre em "Erros conhecidos" e avise; corrigir é outra tarefa.
- Nada desta skill vai para dentro de `pipeline/` além do `skills.json`, do `flow.yaml` e das skills do projeto movidas com OK. O mapa é produto: `docs/FEATURE-MAP.md`.
- Depois do onboard, quem mantém o mapa em dia é a etapa `implement` (veja `pipeline/adapters/tdd.md`).
