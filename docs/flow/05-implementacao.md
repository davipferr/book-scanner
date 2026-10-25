---
step: implement
skill: tdd
inputs:
  - docs/flow/03-prd.md
  - docs/flow/04-arquitetura.md
---

# Implementação: redesign "tecido de encadernação"

## Como rodar os testes
```bash
npm test
```

```bash
npm run build
```

## Fatias
### 1. Tecido do livro — CA-1
- Testes: `src/cloth.test.ts` › "always gives the same cloth for the same book", "picks from a fixed palette of five or six cloths", "uses every cloth across consecutive ids", "copes with odd ids"
- Resultado: 4 passando (vermelho antes de existir `src/cloth.ts`)
- Notas: `renderLibrary` (`src/main.ts`) desenha cada livro como `.book-cover[data-cloth]` com o título num `.book-stamp` dourado. A foto da primeira página deixou de ser a capa (o tecido é a capa), o que também tira uma leitura do IndexedDB por livro. O título repetido embaixo da capa ficou só para leitores de tela (`.book-title` visualmente oculto), e a linha de meta passou de "N pages · data" para "N pages, data".

### 2. Tokens, cores e PWA — CA-2, CA-6, CA-9
- Testes: `src/theme.test.ts` › "keeps body and muted text readable on the background and surfaces (AA)", "keeps gilt titles readable on every cloth", "keeps primary button text readable", "keeps danger and gilt text readable on the background", "declares colors only on :root", "gives every cloth a token and a selector", "keeps the camera surround neutral"; `src/markup.test.ts` › "matches the PWA colors to the theme background"
- Resultado: 8 passando
- Notas: `src/style.css` reescrito sobre tokens em `:root` (fundo verde-garrafa `#15251e`, pergaminho, dourado, 6 tecidos, tons de destaque, `--void` preto para câmera/visualizador/editor). `index.html` e `public/manifest.webmanifest` com `#15251e`. Para os testes lerem o CSS com `?raw`, o `vite.config.ts` ganhou `test.css: true` (o vitest troca CSS por string vazia por padrão). A proibição "cor só em `:root`" foi conferida por mutação: uma `color: #fff` fora de `:root` faz o teste falhar.

### 3. Tipografia auto-hospedada — CA-5, CA-7
- Testes: `src/markup.test.ts` › "loads no stylesheet or font from another site", "ships only the latin subsets of Literata and Alegreya Sans"; `src/theme.test.ts` › "sets page text in Literata at a comfortable measure", "retones the four stored highlight colors"
- Resultado: 4 passando; `npm run build` emite 6 woff2 (cerca de 240 KB) e todos aparecem no pré-cache do `dist/sw.js`
- Notas: devDependencies `@fontsource-variable/literata@5.3.0` e `@fontsource/alegreya-sans@5.3.0` (OFL-1.1). `src/fonts.css` declara só latin + latin-ext da Literata (normal e itálico, eixo de peso) e latin da Alegreya Sans (400 e 700), importado no topo de `src/main.ts`. Desvio da estimativa da conversa (100–200 KB): ficou em cerca de 240 KB, por causa do itálico da Literata, usado em notas e rótulos do leitor. Leitor com `max-width: 66ch`.

### 4. Controles acessíveis e marcação — CA-3, CA-4, CA-8
- Testes: `src/theme.test.ts` › "shows a visible focus ring in the accent color", "makes touch targets at least 44px tall"; `src/markup.test.ts` › "keeps every element id that main.ts looks up"
- Resultado: 3 passando; suíte inteira 13 arquivos, 80 testes; `npm run build` (typecheck + build) passa
- Notas: `:focus-visible` global com contorno dourado de 2px; botões, abas, selects, busca, `.back-button`, `.link-button`, rótulo de página do leitor, botão do chip de inserção e amostras de cor com pelo menos 44px (as amostras mostram um ponto de 28px dentro de um alvo de 44px). `prefers-reduced-motion` respeitado. Conferido no navegador (375×812): nenhuma rolagem horizontal nem alvo abaixo de 44px na biblioteca, nas abas Pages/Read/Highlights e no visualizador. Nenhum id foi alterado no `index.html`; as mudanças de marcação ficaram no `renderLibrary`.

### 5. Correção da verificação: linha extra sob o título truncado — CA-1
- Testes: `src/theme.test.ts` › "clamps long titles on an element without vertical padding" (vermelho antes da correção: o clamp estava em `.book-stamp`, que tem padding)
- Resultado: 81 passando; typecheck ok
- Notas: o título da capa agora fica num `span.book-stamp-text` dentro do `.book-stamp` (`src/main.ts` › `renderLibrary`); o clamp de 5 linhas está no span, sem padding, e os filetes e o espaçamento ficam no `.book-stamp`. No navegador, o título longo da verificação termina em 5 linhas com reticência e nada abaixo (`textBottom` = borda interna do filete).

## Mapa de funcionalidades

### Instalar e rodar
- Requisitos: Node 22+
- Instalar: `npm install`
- Rodar: `npm run dev` → `http://localhost:5173/` (produção: `npm run build` e `npm run preview` → `http://localhost:4173/`)
- Testes: `npm test` · Typecheck/build: `npm run build`

### Funcionalidades
| Funcionalidade | Como acionar (comando, rota, tela → clique, atalho) | Código | CA |
|----------------|------------------------------------------------------|--------|----|
| Capa de tecido por livro, com título dourado | Abrir o app → biblioteca (`#book-list` › `.book-card` › `.book-cover[data-cloth]`) | `src/cloth.ts` › `bookCloth`; `src/main.ts` › `renderLibrary`; `src/style.css` › `.book-cover`, `.book-stamp`, `.book-stamp-text` | CA-1 |
| Tema escuro de tecido (tokens) | Qualquer tela | `src/style.css` › `:root` | CA-2, CA-9 |
| Cores da PWA | `<meta name="theme-color">`, manifest | `index.html`; `public/manifest.webmanifest` | CA-6 |
| Fontes auto-hospedadas | Carregadas com o app; offline depois de instalado o service worker | `src/fonts.css`; import em `src/main.ts` | CA-5 |
| Leitura em Literata com destaques retonados | Livro → aba "Read" (`data-tab="read"`) | `src/style.css` › `.reader`, `.reader-text`, `.hl-*` | CA-7 |
| Foco visível e alvos de 44px | Tab pelo teclado em qualquer tela | `src/style.css` › `:focus-visible` e regras de controles | CA-3, CA-4 |

### Entradas e saídas
- Sem mudança: IndexedDB `book-scanner` e chaves de localStorage iguais; nenhuma chamada de rede nova (as fontes vêm do próprio site).

### Erros conhecidos e códigos de saída
- A câmera não abre no painel de navegador embutido do Claude (permissão bloqueada); lá aparece "Camera permission was denied." com "Try again" e "Take or choose photos". Num navegador comum, em `localhost` ou `https`, a câmera abre.

## Em aberto
- nenhum
