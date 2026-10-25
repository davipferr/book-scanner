---
step: ship
skill: ship-report
inputs:
  - docs/flow/03-prd.md
  - docs/flow/06-verificacao.md
  - docs/flow/07-revisao.md
---

# Entrega: redesign "tecido de encadernação"

**Em uma frase:** o Book Scanner deixou de parecer um template e passou a parecer um livro encadernado: fundo de tecido verde-garrafa, texto em pergaminho, dourado no que se toca, Literata para ler e uma estante em que cada livro é uma capa de tecido com o título gravado em dourado. Tudo continua offline e nenhuma função mudou.

## Como rodar
```bash
npm install
npm run dev
npm test
npm run build
```
`npm run dev` abre em `http://localhost:5173/`. Para ver o service worker e o offline: `npm run build` e depois `npm run preview` (`http://localhost:4173/`). Testes: 13 arquivos, 81 passando.

## Decisões que importam
- Só tema escuro, na direção "tecido de encadernação", guiada pela skill `frontend-design` — ver [02-decisoes.md](02-decisoes.md)
- A cor de cada capa vem do id do livro (6 tecidos), sem mudança no banco — ver [02-decisoes.md](02-decisoes.md) e `src/cloth.ts`
- Fontes auto-hospedadas (Literata e Alegreya Sans, só latin, cerca de 240 KB) e pré-cacheadas pelo service worker — ver [04-arquitetura.md](04-arquitetura.md)
- Toda cor é um token em `:root`; um teste falha se aparecer cor solta no CSS — ver [04-arquitetura.md](04-arquitetura.md)
- Acessibilidade como critério de aceite: contraste AA testado, foco dourado visível, alvos de 44px — ver [03-prd.md](03-prd.md)

## Pendências
- Os campos numéricos "From/to" da exportação têm 40px de altura (abaixo dos 44px dos botões); não bloqueia, ver [07-revisao.md](07-revisao.md).
- Nada mais em aberto nos artefatos.

## Trabalho manual
| O que um humano precisou fazer (ou ficou sem verificar) | Regra dura que evitaria |
|----------------------------------------------------------|-------------------------|
| Depois do `adopt`, o dono precisou aprovar (`git add`) a base do pipeline, porque o `guard` bloqueou a primeira etapa ao ver `pipeline/`, `AGENTS.md` e `CLAUDE.md` como alterados | o `adopt` termina com `git add` da base que ele mesmo copiou (ou o `onboard` checa que a base está no índice antes de liberar a primeira etapa) |
| Depois do `adopt`, `npm test` do projeto quebrou: o vitest pegou `pipeline/test/*.test.ts` (corrigido no onboard com `test.exclude`) | o `adopt` detecta vitest/jest no projeto e avisa ou acrescenta a exclusão de `pipeline/**`; um teste do `adopt` cobre um projeto com vitest |
| Não verificado: instalação real do service worker e uso offline (o navegador embutido recusa o registro) | a `verify` roda o build de produção num navegador que aceita service worker (ex.: Playwright com Chromium) e confere `caches` com as fontes |
| Não verificado: câmera ao vivo no scanner (bloqueada no navegador embutido) | a `verify` usa um navegador com câmera falsa (Chromium `--use-fake-device-for-media-stream`) para abrir o scanner de verdade |

## Trilha
1. [01-ideia.md](01-ideia.md) — a ideia como chegou
2. [02-decisoes.md](02-decisoes.md) — o interrogatório
3. [03-prd.md](03-prd.md) — escopo e critérios de aceite
4. [04-arquitetura.md](04-arquitetura.md) — módulos e fatias
5. [05-implementacao.md](05-implementacao.md) — o que foi feito, fatia a fatia
6. [06-verificacao.md](06-verificacao.md) — o programa usado como usuário, com as provas
7. [07-revisao.md](07-revisao.md) — o veredito contra o PRD

Próximo passo: `npm --prefix pipeline run archive` guarda esta execução em `docs/runs/` e libera `docs/flow/` para a próxima ideia.
