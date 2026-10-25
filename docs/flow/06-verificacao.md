---
step: verify
skill: verify
inputs:
  - docs/flow/03-prd.md
  - docs/flow/04-arquitetura.md
  - docs/flow/05-implementacao.md
---

# Verificação: redesign "tecido de encadernação"

**Veredito:** aprovado

## Ambiente
- Cópia limpa em: `%TEMP%\bs-verify\copy with space` (sem `node_modules`, `dist`, `pipeline/`, `docs/`, `.git/`, `.claude/`, `.agents/`; caminho com espaço de propósito)
- Sistema e runtime: Windows 11 Pro, Node 25.5.0; navegador: painel de navegador embutido do Claude (Chromium), viewport 375×812
- Instalação: `npm ci` → ok
- Build/typecheck/testes (2ª rodada, depois da correção da falha 1): `npm test` → `Test Files 13 passed (13)`, `Tests 81 passed (81)`; `npm run build` → `✓ built in 1.23s`; `grep -c woff2 dist/sw.js` → `6`

## Funcionalidades (como usuário)
| Funcionalidade (mapa do 05) | CA | Comando / ação | Saída real (trecho) | ✅/❌ |
|-----------------------------|----|----------------|---------------------|-------|
| Capa de tecido por livro | CA-1 | 150 livros criados; comparar `.book-cover[data-cloth]` com `bookCloth(id)` | `{"count":150,"mismatch":0,"distinctBackgrounds":6}` | ✅ |
| Capa com título longo | CA-1 | livro "Uma Longuíssima Tentativa de Título Excessivamente Comprido Sobre Paralelepípedos…" → biblioteca; medir `.book-stamp-text` | 1ª rodada: 6ª linha visível sob a reticência (falha 1). 2ª rodada: `{"lines":5,"stampInnerBottom":443,"textBottom":443}`, screenshot com "Excessivame…" e nada abaixo | ✅ |
| Tema escuro de tecido | CA-2 | abrir biblioteca, livro (Pages/Read/Highlights), visualizador, editor, texto, exportar | screenshots coerentes; contraste conferido pelos testes de tokens | ✅ |
| Cores da PWA | CA-6 | build de produção em `:4180`, `document.querySelector('meta[name=theme-color]').content` | `#15251e` (= `--bg`); manifest com `#15251e` | ✅ |
| Fontes auto-hospedadas | CA-5 | build em `:4180`, `performance.getEntriesByType('resource')` de outra origem; `document.fonts` | `"foreign": []`; `"Literata normal","Alegreya Sans normal"` carregadas | ✅ |
| Leitura em Literata e destaques | CA-7 | livro com texto e 4 destaques → aba Read | `getComputedStyle(.reader).fontFamily` → `Literata, Georgia, …`; destaques amarelo/verde/azul/rosa visíveis com os novos tons | ✅ |
| Foco visível | CA-3 | build em `:4180`, tecla Tab duas vezes | `{"el":"new-book","outline":"solid 2px rgb(217, 184, 98)"}`, `{"el":"library-search","outline":"solid 2px rgb(217, 184, 98)"}` | ✅ |
| Alvos de 44px e sem rolagem horizontal | CA-4 | auditoria JS de botões/inputs/abas visíveis em library, pages, read, notes, viewer | `"overflow": false, "small": []` nas 5 telas | ✅ |
| Ids preservados, testes e build | CA-8 | `npm test`, `npm run build` na cópia limpa | 81 passando; build ok | ✅ |
| Scanner neutro | CA-9 | Livro → "Scan pages" | entorno preto; mensagem "Camera permission was denied." com "Try again" e "Take or choose photos" | ✅ |

## Bordas
| Caso | Comando / ação | Saída real (trecho) | ✅/❌ |
|------|----------------|---------------------|-------|
| biblioteca vazia | build em `:4180` (banco vazio) | "No books yet. Create one, then photograph its pages. Everything stays on this device." centralizado em Literata | ✅ |
| título com acentos e emoji | livro "Ação & Reação 📚 — çãõ" | renderiza com acentos e o emoji em cor, sem quebra | ✅ |
| título de 1 caractere | livro "X" | centralizado entre os filetes | ✅ |
| título muito longo | ver tabela acima | 5 linhas com reticência, nada abaixo (2ª rodada) | ✅ |
| volume (150 livros) | 150 livros, recarregar | `navTiming: 45` ms; sem rolagem horizontal | ✅ |
| ids grandes/negativos | `src/cloth.test.ts` › "copes with odd ids" | passa | ✅ |

## Como repetir
A partir da raiz do repositório, numa cópia fora dele:
```bash
t="$TEMP/bs-verify/copy with space"; rm -rf "$TEMP/bs-verify"; mkdir -p "$t"
tar --exclude=./node_modules --exclude=./dist --exclude=./pipeline --exclude=./docs --exclude=./.git --exclude=./.claude --exclude=./.agents -cf - . | tar -xf - -C "$t"
(cd "$t" && npm ci && npm test && npm run build && grep -c woff2 dist/sw.js)   # esperado: 81 passed; built; 6
rm -rf "$TEMP/bs-verify"
```
Visual: `npm run dev`, no console do navegador em `http://localhost:5173/` rode `const db = await import('/src/db.ts'); await db.createBook('Uma Longuíssima Tentativa de Título Excessivamente Comprido Sobre Paralelepípedos Inconstitucionalíssimos e Outras Coisas'); location.reload()` e olhe a capa (esperado: 5 linhas no máximo, nada abaixo da reticência).

## Falhas
- nenhuma em aberto. A 1ª rodada achou uma (linha extra sob o título truncado na capa: `-webkit-line-clamp` em `.book-stamp`, que tinha padding vertical). Corrigida na fatia 5 do `05-implementacao.md` e conferida de novo acima.

## Não verificado
- Instalação real do service worker e uso offline: o painel de navegador embutido recusa o registro ("Failed to register a ServiceWorker … An unknown error occurred when fetching the script."), embora `GET /sw.js` responda 200 com as 6 fontes na lista. Verificado só que as fontes estão no pré-cache do `dist/sw.js`.
- Câmera ao vivo: bloqueada no painel embutido; o entorno neutro foi conferido com a mensagem de câmera indisponível.
