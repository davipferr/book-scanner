# Usar com Claude e ChatGPT

As skills seguem o padrão aberto **Agent Skills**, então a mesma pasta funciona em vários agentes. O que muda é **onde** cada agente procura as skills e se ele consegue rodar comandos (`npm --prefix pipeline run status`) e gravar arquivos.

| Ambiente | Lê as skills sozinho? | Roda comandos e grava arquivos? | Experiência |
|----------|------------------------|-------------------------------|-------------|
| **Claude Code** (terminal, desktop, IDE) | sim, de `.claude/skills/` | sim | completa |
| **Codex** (CLI / IDE da OpenAI) | sim, de `.agents/skills/` | sim | completa |
| Cursor, Gemini CLI, Copilot, OpenCode... | sim, de `.agents/skills/` | sim | completa |
| **Claude.ai** (web/desktop, chat) | sim, se você enviar a skill como .zip | não grava no seu disco | manual |
| **ChatGPT** (web) | não | não grava no seu disco | manual, colando prompts |

## Claude Code

```bash
npm --prefix pipeline run setup
```

Abra o Claude Code na raiz do repositório e peça "rode o pipeline", ou digite `/run-pipeline`. O `CLAUDE.md` já aponta para o maestro. Para ver as skills carregadas, digite `/skills`.

## Codex (OpenAI)

```bash
npm --prefix pipeline run setup
```

O `setup` instala em `.agents/skills/` porque `codex` está em `agents` no `pipeline/skills.json`. Abra o Codex na raiz do repositório; ele lê o `AGENTS.md`, que manda usar a skill `run-pipeline`.

Para outros agentes (Cursor, Gemini CLI etc.), adicione o nome deles em `agents` no `pipeline/skills.json` e rode `npm --prefix pipeline run setup` de novo. A lista de nomes aceitos está na documentação do CLI: `npx skills add --help`.

## Claude.ai (web ou app, aba de chat)

O Claude.ai aceita skills enviadas como .zip em **Settings → Capabilities → Skills**. Lá ele **não** acessa o seu disco, então:

1. Compacte a pasta de cada skill que for usar (ex.: `pipeline/skills/write-prd/` → `write-prd.zip`) e envie.
2. Em vez do `npm --prefix pipeline run status`, você é o maestro: cole o conteúdo dos arquivos de entrada da etapa na conversa e peça a etapa ("use a skill write-prd com estes dois arquivos").
3. Salve a resposta no arquivo de saída em `docs/flow/` e rode `npm --prefix pipeline run status` no seu terminal para conferir.

Para as skills externas, baixe a pasta do GitHub (ex.: `mattpocock/skills/skills/productivity/grilling/`), compacte e envie da mesma forma.

## ChatGPT (web)

O ChatGPT web não carrega `SKILL.md` automaticamente, mas o CLI do skills.sh gera um prompt pronto para colar:

```bash
npx skills use ./pipeline --skill write-prd
```

A saída começa com *"You are being given a Skill to execute..."* seguida do `SKILL.md`. O fluxo manual fica assim:

1. Rode `npm --prefix pipeline run status` e veja a próxima etapa e a skill.
2. Gere o prompt da skill com `npx skills use` (para externas: `npx skills use mattpocock/skills --skill grilling`).
3. Cole no ChatGPT o prompt, o adapter da etapa (se houver, em `pipeline/adapters/`) e o conteúdo dos arquivos de entrada.
4. Salve a resposta no arquivo de saída indicado no `pipeline/flow.yaml`.
5. Repita.

Para não colar sempre, crie um **GPT** ou um **Projeto** no ChatGPT com o `SKILL.md` de `run-pipeline` e o `contrato-dos-artefatos.md` nas instruções, e envie os `SKILL.md` das etapas como arquivos do projeto.

## Qual escolher?

Para **aprender como as skills se encadeiam**, use um agente com acesso ao disco (Claude Code ou Codex). O loop do maestro (status → skill → arquivo → status) fica visível e automático. O modo manual do Claude.ai e do ChatGPT é bom para entender o que cada skill faz, porque você mesmo faz o papel do maestro.
