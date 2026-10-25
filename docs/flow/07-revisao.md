---
step: review
skill: review-against-prd
inputs:
  - docs/flow/03-prd.md
  - docs/flow/04-arquitetura.md
  - docs/flow/05-implementacao.md
  - docs/flow/06-verificacao.md
---

# Revisão: redesign "tecido de encadernação"

**Veredito:** aprovado

## Testes e verificação repetida
```
$ npm test                       (no repositório)
 Test Files  13 passed (13)
      Tests  81 passed (81)

"Como repetir" de 06-verificacao.md (cópia limpa em "%TEMP%\bs-verify\copy with space"):
$ npm ci && npm test && npm run build && grep -c woff2 dist/sw.js
 Tests  81 passed (81)
 ✓ built in 1.23s
 6

$ grep -n "outline: *none\|outline: *0" src/style.css      → (nada: nenhum foco removido)
$ grep -n "min-height: 4[0-3]px\|height: 4[0-3]px" src/style.css
 963:  min-height: 40px;      (.range input, os campos numéricos "From/to" do export)
```

## Critérios de aceite
| CA | Veredito | Evidência |
|----|----------|-----------|
| CA-1 | ✅ | `src/cloth.test.ts` › os 4 testes de `bookCloth` · verificação: "Capa de tecido por livro" (150 livros, `mismatch: 0`, 6 fundos) e "Capa com título longo" (2ª rodada) |
| CA-2 | ✅ | `src/theme.test.ts` › "keeps body and muted text readable on the background and surfaces (AA)", "keeps gilt titles readable on every cloth", "keeps primary button text readable", "keeps danger and gilt text readable on the background" · verificação: "Tema escuro de tecido" |
| CA-3 | ✅ | `src/theme.test.ts` › "shows a visible focus ring in the accent color"; nenhum `outline: none` no CSS · verificação: "Foco visível" (Tab → `solid 2px rgb(217, 184, 98)`) |
| CA-4 | ✅ | `src/theme.test.ts` › "makes touch targets at least 44px tall" · verificação: "Alvos de 44px e sem rolagem horizontal" (5 telas, `small: []`, `overflow: false`). Observação, não bloqueante: os dois campos numéricos "From/to" do export têm 40px; o CA fala de botões e abas, e eles ficam dentro de uma linha `.choice` de 48px |
| CA-5 | ✅ | `src/markup.test.ts` › "loads no stylesheet or font from another site", "ships only the latin subsets of Literata and Alegreya Sans" · build: `grep -c woff2 dist/sw.js` → 6 · verificação: "Fontes auto-hospedadas" (`foreign: []`) |
| CA-6 | ✅ | `src/markup.test.ts` › "matches the PWA colors to the theme background" · verificação: "Cores da PWA" (`#15251e`) |
| CA-7 | ✅ | `src/theme.test.ts` › "sets page text in Literata at a comfortable measure" (66ch), "retones the four stored highlight colors" · verificação: "Leitura em Literata e destaques" |
| CA-8 | ✅ | `src/markup.test.ts` › "keeps every element id that main.ts looks up" (o `$` do `main.ts` é o único acesso por id: `document.getElementById`); suíte 81/81; `npm run build` ok na cópia limpa |
| CA-9 | ✅ | `src/theme.test.ts` › "keeps the camera surround neutral" · verificação: "Scanner neutro" (com a câmera indisponível; câmera ao vivo listada em "Não verificado") |

## Arquitetura
- Os módulos batem com `04-arquitetura.md`: `src/cloth.ts` (`CLOTHS`, `bookCloth`), `src/fonts.css`, `src/style.css` sobre tokens, `index.html` com os mesmos ids, `src/main.ts` mudando só o `renderLibrary` e o import das fontes.
- Desvios, todos justificados no `05-implementacao.md`: `test.css: true` no `vite.config.ts` (sem isso o `?raw` do CSS chega vazio no vitest); `span.book-stamp-text` dentro do selo (correção da falha da verificação); a foto da primeira página deixou de ser a capa (a capa passou a ser o tecido, decisão 5); fontes em cerca de 240 KB, acima da estimativa de 100–200 KB, por causa do itálico da Literata.
- Proibições:
  - cor só em `:root` → `src/theme.test.ts` › "declares colors only on :root", passando; conferida por mutação (uma `color: #fff` fora de `:root` faz o teste falhar).
  - ids do `main.ts` no HTML → `src/markup.test.ts` › "keeps every element id that main.ts looks up", passando.
  - nenhuma fonte ou estilo de outro domínio → `src/markup.test.ts` › "loads no stylesheet or font from another site", passando.
  - só subconjuntos latin → `src/markup.test.ts` › "ships only the latin subsets of Literata and Alegreya Sans", passando.

## Escopo extra
- Nada do "Fora de escopo": sem tema claro, sem ícones novos, sem mudança de fluxo, navegação ou modelo de dados (IndexedDB e localStorage iguais).
- Fora do PRD, mas dentro do patamar de qualidade da `frontend-design`: regra `prefers-reduced-motion`. A meta da capa trocou "N pages · data" por "N pages, data" (texto, permitido pela decisão 1).

## O que corrigir (se reprovado)
- nada
