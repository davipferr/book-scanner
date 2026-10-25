# Mapa de funcionalidades: Book Scanner

O mapa do projeto: como instalar e rodar, como acionar cada funcionalidade, onde está o código e qual teste a cobre. Um agente que for mexer no projeto, verificar uma entrega ou investigar um bug começa por aqui, em vez de adivinhar. Caminhos a partir da raiz do repositório. Escrito pela skill `onboard`; a etapa `implement` do pipeline o mantém em dia.

App web estático (PWA) em TypeScript + Vite, sem framework de UI: `index.html` tem toda a marcação (views e `<dialog>`s), `src/main.ts` liga os eventos, `src/style.css` é o único CSS. Sem servidor: livros e páginas ficam no IndexedDB do navegador. Publicado no GitHub Pages pelo `.github/workflows/ci.yml`.

## Instalar e rodar
- Requisitos: Node 22+ (CI usa 22; verificado localmente com 25.5.0). Nenhuma variável de ambiente.
- Instalar: `npm install`
- Rodar (dev): `npm run dev` → `http://localhost:5173/` (também exposto na LAN; a câmera exige `https://` ou `localhost`, então no celular via `http://192.168.x.x:5173` só o "Take or choose photos" funciona). Sem service worker no dev.
- Rodar (produção local, com service worker/offline): `npm run build` e depois `npm run preview` → `http://localhost:4173/`
- Testes: `npm test` (vitest; `pipeline/**` excluído e `css: true` no `vite.config.ts`, para os testes lerem o CSS com `?raw`) → 13 arquivos, 80 passando
- Build/typecheck: `npm run build` (roda `npm run typecheck` = `tsc --noEmit` nos dois tsconfig, depois `vite build` → `dist/`). Não há lint.
- Ícones: `python scripts/make-icons.py` (precisa de Pillow) → `public/icons/`. Não verificado: não foi necessário regenerar.

## Funcionalidades
| Funcionalidade | Como acionar (comando, rota, tela → clique, atalho) | Código | Teste |
|----------------|------------------------------------------------------|--------|-------|
| Listar livros como capas de tecido com título dourado (cor fixa pelo id), nº de páginas, data, uso de armazenamento | Abrir o app → view `#library` (`.book-card` › `.book-cover[data-cloth]` › `.book-stamp` › `.book-stamp-text`) | `src/main.ts` › `renderLibrary`; `src/cloth.ts` › `bookCloth`; `src/db.ts` › `listBooks`, `storageEstimate` | `src/cloth.test.ts` |
| Criar livro | Biblioteca → `#new-book` "New book" → prompt com o título | `src/main.ts` (handler de `#new-book`); `src/db.ts` › `createBook`, `requestPersistence` | — |
| Renomear / apagar livro | Livro → rodapé `#rename-book` "Rename book" / `#delete-book` "Delete book" (confirm) | `src/main.ts`; `src/db.ts` › `renameBook`, `deleteBook` | — |
| Buscar em todos os livros (ignora acento e caixa; texto, notas, destaques) | Biblioteca → `#library-search` (debounce 250 ms) → clicar no resultado abre o livro na aba Read no trecho | `src/main.ts` › `searchLibrary`, `openHit`; `src/searchview.ts` › `searchBooks`, `renderHits`; `src/search.ts` › `findAll`, `fold`, `snippet` | `src/search.test.ts` |
| Buscar no livro aberto | Livro → `#book-search` (debounce 200 ms) | `src/main.ts` › `searchBook` | `src/search.test.ts` |
| Escanear com a câmera (câmera traseira, lanterna, flash visual, vibração) | Livro → `#scan` "Scan pages" → `#shutter`; `#torch` alterna a lanterna (se houver) | `src/main.ts` › `startCamera`, handler de `#shutter`; `src/camera.ts` › `Camera` | — |
| Câmera indisponível (HTTP, sem suporte, negada) | Abrir o scanner sem câmera → `#camera-message` com `#retry-camera` "Try again" e input de fotos | `src/camera.ts` › `CameraUnavailable`; `src/main.ts` › `startCamera` | — |
| Adicionar fotos da galeria | Scanner → "Take or choose photos" (`#file-input`) ou Livro → `#file-input-2` | `src/main.ts` › `addFiles`; `src/camera.ts` › `normalizePhoto`; `src/size.ts` › `fitWithin` | `src/size.test.ts` |
| Ver página (anterior/próxima) | Livro → aba Pages → clicar no tile → `<dialog id="viewer">`; `‹ ›` ou setas ← → | `src/main.ts` › `openViewer`, `step` | — |
| Recortar/endireitar página (detecção automática, cantos arrastáveis, perspectiva, girar, filtros Original/Gray/Document) | Viewer → `#viewer-edit` "Edit" → `<dialog id="editor">` (Auto, Full photo, Preview, girar, filtros, Save) | `src/editor.ts` › `PageEditor`, `initialEdit`; `src/processing.ts` › `renderPage`, `detectCorners`; `src/process.worker.ts`; `src/raster.ts` › `detectPage`, `warpPerspective`, `documentFilter`, `grayFilter`; `src/geometry.ts` › `homography` | `src/raster.test.ts`, `src/geometry.test.ts` |
| Limpar todas as páginas não editadas | Livro → `#clean-all` "Clean all" | `src/main.ts` › `cleanAllPages` | `src/raster.test.ts` (núcleo) |
| Mover página / inserir páginas esquecidas | Viewer → `#viewer-move` "Move" (prompt da posição) / `#viewer-insert` "Scan after" (chip "Adding after page N", `#insert-cancel`) | `src/main.ts` › `movePage`, `addPage`; `src/order.ts` › `moveItem`, `insertAt`; `src/db.ts` › `setPageOrder`, `addPage` | `src/order.test.ts` |
| Apagar página | Viewer → `#viewer-delete` "Delete" (confirm) | `src/main.ts` › `deletePage`; `src/db.ts` › `deletePage` | — |
| Ler texto (OCR) de uma página, editar e copiar | Viewer → `#viewer-text` "Text" → `<dialog id="text-panel">` → "Read text" / editar / "Copy" | `src/textpanel.ts` › `TextPanel`; `src/ocr.ts` › `recognize`; `src/main.ts` › `readPageText` | — |
| Ler texto de todas as páginas | Livro → `#read-all` "Read all text" (progresso no botão) | `src/main.ts` › `readAllPages` | — |
| Idioma do OCR (pt padrão; en, es, misto) | Livro → `#pages-language` ou select do painel de texto | `src/ocr.ts` › `ocrLanguage`, `setOcrLanguage`; `src/textpanel.ts` › `bindLanguageSelect` | — |
| Ler o livro (texto reflowed) | Livro → aba "Read" (`data-tab="read"`) | `src/reader.ts` › `Reader`; `src/text.ts` › `reflowText` | `src/text.test.ts` |
| Destacar texto (4 cores, nota) | Aba Read → selecionar texto → `#selection-bar` (cor) → clicar no destaque abre `<dialog id="note-dialog">` | `src/reader.ts`; `src/notedialog.ts` › `NoteDialog`; `src/highlights.ts` › `anchorHighlight`, `segments`; `src/db.ts` › `addHighlight`, `updateHighlight`, `deleteHighlight` | `src/highlights.test.ts` |
| Nota da página | Aba Read → nota da página | `src/reader.ts`; `src/db.ts` › `updatePageNote` | — |
| Lista de destaques e notas | Livro → aba "Highlights" (`data-tab="notes"`) → clicar abre na aba Read | `src/reader.ts` | — |
| Exportar PDF (completo ou menor), Markdown ou texto; intervalo de páginas; números de página; anotações; baixar ou compartilhar | Livro → `#export` "Export" → `<dialog id="export-panel">` → "Download" / "Share" | `src/exportpanel.ts` › `ExportPanel`; `src/pdf.ts` › `buildPdf`, `jpegInfo`; `src/export.ts` › `bookText`, `fileName`; `src/processing.ts` › `shrinkImage` | `src/pdf.test.ts`, `src/export.test.ts` |
| Instalar como app (card de instalação / passos no iOS) | Biblioteca → `#install-card` → `#install-button` "Install" ou `#install-dismiss` "Not now" | `src/pwa.ts` › `setupInstallCard`, `isStandalone` | — |
| Offline e aviso de nova versão | Só em produção (`npm run build && npm run preview`) → toast `#update-toast` → `#update-reload` "Update" | `src/pwa.ts` › `registerServiceWorker`; `build/pwa.ts` › `pwa`, `serviceWorkerSource`; `build/service-worker.js` | `build/pwa.test.ts` |

| Tema visual "tecido de encadernação" (só escuro): tokens de cor, contraste AA, foco visível, alvos de 44px | Qualquer tela; Tab pelo teclado | `src/style.css` › `:root` (todas as cores ficam aí) | `src/theme.test.ts` |
| Fontes auto-hospedadas (Literata para títulos e leitura, Alegreya Sans para controles) | Carregadas com o app; pré-cacheadas pelo service worker | `src/fonts.css` (import em `src/main.ts`) | `src/markup.test.ts` › "fonts" |
| Cores da PWA iguais ao fundo do tema | `<meta name="theme-color">`, `public/manifest.webmanifest` | `index.html`; `public/manifest.webmanifest` | `src/markup.test.ts` › "matches the PWA colors to the theme background" |

## Entradas e saídas
- IndexedDB `book-scanner` (`src/db.ts`): livros, páginas (imagem original + editada, texto OCR, nota) e destaques. Nada sai do aparelho.
- localStorage: `book-scanner.filter` (último filtro do editor), `book-scanner.ocr-language`, `book-scanner.install-dismissed`.
- Rede: worker e core do Tesseract servidos pelo próprio site em `tesseract/<versão>/` e `tesseract-core/<versão>/` (copiados no build por `build/pwa.ts`); os dados de idioma vêm do jsDelivr no primeiro OCR e depois ficam em cache.
- Entradas: câmera (`getUserMedia`, precisa de contexto seguro) e arquivos de imagem. Saídas: downloads `.pdf` / `.md` / `.txt` ou o share sheet (`navigator.share`).
- Portas: 5173 (dev), 4173 (preview).
- Fontes: woff2 dos pacotes `@fontsource-variable/literata` e `@fontsource/alegreya-sans` (devDependencies), só subconjuntos latin, emitidos em `dist/assets/` pelo Vite.

## Erros conhecidos e códigos de saída
- Erros de operação aparecem num `alert` "<ação>: <mensagem>" (`report` em `src/main.ts`).
- Câmera em HTTP fora do localhost → mensagem de `CameraUnavailable` (reason `insecure`), sem "Try again".
- `npm run dev` / `preview` avisam que `vite.config.ts` importa `./build/pwa` sem extensão (incompatível com `configLoader: 'native'` futuro). Só aviso; não impede nada.
- No painel de navegador embutido do Claude a câmera é bloqueada: o scanner mostra "Camera permission was denied.".
- Depois do `adopt`, o vitest pegava `pipeline/test/*.test.ts` ("No test suite found", 7 arquivos). Corrigido com `test.exclude` no `vite.config.ts`.

## Skills do projeto
Além das skills do pipeline. Buscas feitas com a `find-skills`: `frontend design`, `pwa`, `vite`, `ocr tesseract`, `web accessibility`.

| Skill | Fonte | Quando usar |
|-------|-------|-------------|
| frontend-design | `anthropics/skills` | qualquer mudança visual: direção estética, tipografia, paleta e layout do `index.html` e do `src/style.css` |
| accessibility | `addyosmani/web-quality-skills` | auditar e corrigir a interface (diálogos, abas, câmera, leitor) segundo o WCAG 2.2, sobretudo depois de mudanças de UI |

Consideradas e recusadas pelo usuário: `antfu/skills@vite`, `antfu/skills@vitest`. Sem candidatas boas para OCR/Tesseract (todas com menos de 1K instalações) nem para PWA.
