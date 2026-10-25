---
step: prd
skill: write-prd
inputs:
  - docs/flow/01-ideia.md
  - docs/flow/02-decisoes.md
---

# PRD: redesign "tecido de encadernação"

## Objetivo
O Book Scanner passa a ter uma identidade visual própria, de livro encadernado (tecido escuro, dourado, serifa de leitura), em vez da cara de template, sem perder nenhuma função nem o funcionamento offline.

## Escopo
1. Novo sistema de tokens escuro (cores de tecido, dourado, texto, superfícies) aplicado a todas as telas e diálogos (`src/style.css`).
2. Tipografia própria: uma serifa de leitura (Literata) para títulos e para o texto lido, e uma sans humanista para os controles, auto-hospedadas e pré-cacheadas.
3. Biblioteca com cada livro como capa encadernada em tecido e título gravado em dourado; a cor do tecido é derivada do id do livro.
4. Restilização de controles, abas, diálogos, leitor e destaques (os 4 tons retonados), com pequenos ajustes de marcação e texto onde ajudam, mantendo ids e fluxos.
5. Scanner com controles restilizados e entorno escuro e neutro.
6. `theme-color` e manifest com as cores da nova paleta.

## Fora de escopo
- Tema claro ou seguir o tema do sistema (decidido: só escuro).
- Ícones novos do app.
- Mudanças de comportamento, de fluxo, de navegação ou do modelo de dados (inclusive escolher a cor do livro).

## Critérios de aceite
- **CA-1**: Dado um livro com id N, quando a biblioteca é desenhada, então o cartão do livro recebe a cor de tecido `bookCloth(N)`, que é sempre a mesma para o mesmo id, vem de uma paleta fixa de 5 a 6 tecidos e cobre todos os tecidos para ids consecutivos.
- **CA-2**: Dados os tokens de cor do tema, quando o contraste é calculado (WCAG 2.2), então texto normal sobre o fundo e sobre as superfícies tem razão ≥ 4.5:1, o título dourado sobre cada tecido tem ≥ 4.5:1 e o texto sobre o botão primário tem ≥ 4.5:1.
- **CA-3**: Dado o app aberto, quando o usuário navega pelo teclado (Tab), então todo botão, aba, input e select mostra um contorno de foco visível (`:focus-visible` com outline de pelo menos 2px na cor de destaque).
- **CA-4**: Dado o app numa tela de 375px de largura, quando qualquer view ou diálogo está aberto, então os botões e abas tocáveis medem pelo menos 44px de altura e a página não tem rolagem horizontal.
- **CA-5**: Dado `npm run build`, quando o service worker é gerado, então os arquivos de fonte woff2 da Literata e da sans estão na lista de pré-cache do `dist/sw.js`, e nenhuma folha de estilo ou fonte é carregada de outro domínio.
- **CA-6**: Dado o app instalado ou aberto, quando a página carrega, então `<meta name="theme-color">` e `theme_color`/`background_color` do manifest são a cor de fundo do novo tema.
- **CA-7**: Dado o texto de uma página na aba Read, quando é exibido, então usa a Literata, com linhas de no máximo cerca de 70 caracteres (`max-width` em `ch`), e os 4 destaques (yellow, green, blue, pink) aparecem com os novos tons, mantendo a mesma chave gravada.
- **CA-8**: Dadas as funções existentes, quando os testes rodam (`npm test`) e o typecheck/build rodam (`npm run build`), então tudo passa, e todos os ids usados por `src/main.ts` continuam existindo no `index.html`.
- **CA-9**: Dado o scanner aberto, quando a câmera está ativa, então o fundo em volta do vídeo continua escuro e neutro (sem tecido colorido nem dourado atrás da imagem).

## Restrições técnicas
- Site estático (Vite + TypeScript, sem framework), PWA no GitHub Pages, funciona offline.
- Fontes auto-hospedadas no build (woff2), sem CDN; até 2 famílias.
- Sem mudança no IndexedDB nem em `src/main.ts` além do necessário para aplicar a cor do livro.
- Contraste WCAG 2.2 AA, foco visível e alvos de 44px (conferidos com a skill `accessibility`).

## Em aberto
- Qual sans humanista acompanha a Literata — não bloqueia: decidido na arquitetura.
