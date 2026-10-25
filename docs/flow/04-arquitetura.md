---
step: architecture
skill: plan-architecture
inputs:
  - docs/flow/03-prd.md
---

# Arquitetura: redesign "tecido de encadernação"

## Visão geral
O redesign é quase todo CSS: `src/style.css` ganha um sistema de tokens em `:root` (fundo de tecido escuro, superfícies, pergaminho para o texto, dourado, os tecidos dos livros, os tons dos destaques) e todas as regras passam a usar só esses tokens. As fontes entram por `src/fonts.css` (importado no `main.ts`), com `@font-face` apontando para os woff2 dos pacotes Fontsource. Assim o Vite as emite como assets do bundle e o plugin `build/pwa.ts` as pré-cacheia sem mudança. A única lógica nova é `bookCloth(id)`, que o `renderLibrary` usa para marcar cada capa com `data-cloth`.

## Stack
- Linguagem/runtime: TypeScript + Vite 8, sem framework (como hoje).
- Dependências novas (devDependencies, só arquivos de fonte, licença OFL-1.1):
  - `@fontsource-variable/literata`: serifa de leitura (títulos, texto lido, notas), variável em peso e com itálico.
  - `@fontsource/alegreya-sans`: sans humanista de traço caligráfico, irmã da Alegreya e próxima do universo do livro, para os controles. Pesos 400, 500 e 700.
  - Só os subconjuntos `latin` e `latin-ext` (português e espanhol cabem neles). Os outros alfabetos não entram no bundle nem no pré-cache.

## Módulos
| Módulo | Responsabilidade | Interface pública |
|--------|------------------|-------------------|
| `src/cloth.ts` | escolher o tecido da capa de um livro a partir do id | `CLOTHS: readonly ClothName[]`, `bookCloth(id: number): ClothName` |
| `src/fonts.css` | declarar as fontes auto-hospedadas (`@font-face`, só latin/latin-ext) | as famílias `Literata` e `Alegreya Sans` |
| `src/style.css` | tokens em `:root` + todas as regras visuais | tokens `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--gilt`, `--on-gilt`, `--danger`, `--cloth-<nome>`, `--hl-<cor>`; `[data-cloth="<nome>"]` |
| `index.html` | marcação (ajustes leves de estrutura e texto; mesmos ids) | ids usados por `src/main.ts` |
| `src/main.ts` | só muda o `renderLibrary`: `button.dataset.cloth = bookCloth(b.id)` e a capa com título gravado | — |

## Interfaces a testar
- **`bookCloth(id)`** (`src/cloth.test.ts`) — pega: determinismo, valor sempre da paleta, ids consecutivos cobrem todos os tecidos, ids negativos/grandes não quebram · deixa passar: se a cor aparece de fato na tela (verify).
- **Tokens do tema** (`src/theme.test.ts`, lendo `style.css?raw`) — pega: contraste AA de texto/fundo/superfícies, dourado sobre cada tecido, texto sobre botão primário; cor só em `:root`; regra `:focus-visible` com outline ≥ 2px; alvos de 44px; Literata no leitor com `max-width` em `ch` ≤ 70; os 4 `.hl-*` existem; cada `CLOTHS` tem `--cloth-*` e `[data-cloth]` · deixa passar: a aparência real e o layout em 375px (verify).
- **Marcação e PWA** (`src/markup.test.ts`, lendo `index.html?raw`, `main.ts?raw`, `manifest.webmanifest?raw`, `fonts.css?raw`) — pega: todo id usado por `main.ts` existe no HTML; `theme-color` = manifest `theme_color` = `background_color` = `--bg`; nenhuma URL `http(s)://` para estilo ou fonte no HTML/CSS · deixa passar: o pré-cache das fontes no `dist/sw.js` (verify, com `npm run build`).

Os testes leem os arquivos com imports `?raw` do Vite, para não precisar de tipos do Node no `tsconfig.json` de `src`.

## Estrutura da pasta do código
Segue a organização que o projeto já tem (tudo em `src/`, testes ao lado do código):
```
./
├── index.html            (ajustes leves; mesmos ids)
├── public/manifest.webmanifest  (cores)
└── src/
    ├── cloth.ts / cloth.test.ts
    ├── fonts.css
    ├── style.css         (reescrito sobre tokens)
    ├── theme.test.ts
    ├── markup.test.ts
    └── main.ts           (import './fonts.css'; data-cloth no renderLibrary)
```

## Proibições
| Proibição | Por quê | Como é imposta (teste, lint, script) |
|-----------|---------|--------------------------------------|
| Nenhuma cor literal (`#hex`, `rgb(`, `hsl(`) em `style.css` fora do bloco `:root` | a paleta só vale se for uma; cor solta é o caminho mais curto e quebra o contraste conferido | `src/theme.test.ts` falha ao achar cor fora de `:root` |
| Nenhum id usado por `src/main.ts` pode sumir do `index.html` | "layout leve" não pode quebrar comportamento | `src/markup.test.ts` cruza os `$('…')` do `main.ts` com os `id="…"` do HTML |
| Nenhuma fonte ou folha de estilo de outro domínio | o app precisa funcionar offline e sem CDN | `src/markup.test.ts` procura `http(s)://` em `index.html`, `style.css` e `fonts.css` |
| Nenhum subconjunto de fonte além de latin/latin-ext | cada woff2 vira item do pré-cache | `src/markup.test.ts` exige que todo `url()` do `fonts.css` contenha `-latin-` ou `-latin-ext-` |

## Fatias (ordem de implementação)
1. **Tecido do livro** — cobre CA-1. Pronto quando: `bookCloth` testado e a biblioteca desenha cada livro como capa com `data-cloth` e título gravado em dourado.
2. **Tokens, cores e PWA** — cobre CA-2, CA-6, CA-9. Pronto quando: `:root` com a paleta nova, nenhuma cor fora dele, contrastes AA testados, `theme-color` e manifest iguais a `--bg`, scanner com entorno neutro.
3. **Tipografia auto-hospedada** — cobre CA-5, CA-7. Pronto quando: `fonts.css` com Literata e Alegreya Sans (latin/latin-ext), leitor em Literata com medida em `ch`, destaques retonados, e o `dist/sw.js` lista os woff2.
4. **Controles acessíveis e marcação** — cobre CA-3, CA-4, CA-8. Pronto quando: `:focus-visible` em tudo, alvos de 44px, ajustes de marcação/texto feitos com todos os ids preservados, `npm test` e `npm run build` passando.

## Cobertura dos critérios de aceite
| CA | Fatia |
|----|-------|
| CA-1 | 1 |
| CA-2 | 2 |
| CA-3 | 4 |
| CA-4 | 4 |
| CA-5 | 3 |
| CA-6 | 2 |
| CA-7 | 3 |
| CA-8 | 4 |
| CA-9 | 2 |

## Em aberto
- nenhum
