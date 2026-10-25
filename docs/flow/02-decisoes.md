---
step: grill
skill: grilling
inputs:
  - docs/flow/01-ideia.md
---

# Decisões: redesign visual do Book Scanner

## Decisões
| # | Pergunta | Decisão | Por quê |
|---|----------|---------|---------|
| 1 | Até onde vai o redesign? | Visual + layout leve: tokens, tipografia, cores e estilo dos componentes, com pequenas mudanças de marcação e texto (cabeçalho, cartões da biblioteca, estados vazios). Mesmas telas, mesmos fluxos, mesmos ids; o comportamento do `main.ts` não muda | dar identidade sem reescrever o app |
| 2 | Tema | Só escuro | preferência do usuário |
| 3 | Fontes | 1 a 2 fontes auto-hospedadas (woff2 no build, pré-cacheadas pelo service worker), sem CDN | identidade tipográfica sem perder o offline |
| 4 | Direção estética | "Tecido de encadernação": tecido de livro verde-garrafa e bordô, dourado para acentos e destaques, serifa de leitura (Literata) para o texto lido e uma sans humanista para os controles | remete a livros encadernados, o objeto que o app digitaliza |
| 5 | Elemento marcante | Na biblioteca, cada livro aparece como uma capa encadernada em tecido, com o título gravado em dourado; o resto da interface fica quieto | gastar a ousadia num lugar só |
| 6 | Cor de cada livro | Derivada do id do livro, escolhida de uma paleta fixa de 5 a 6 tecidos | sem mudança no banco nem configuração nova |
| 7 | Cores dos destaques | Continuam as 4 chaves gravadas (yellow, green, blue, pink); só os tons na tela mudam para combinar com a paleta | dados existentes continuam compatíveis |
| 8 | Acessibilidade | Critério de aceite: contraste WCAG 2.2 AA, foco visível no teclado, alvos de toque de pelo menos 44px; conferido com a skill `accessibility` | uso diário no celular |
| 9 | Scanner | Controles restilizados, mas o entorno da câmera continua escuro e neutro | não atrapalhar a captura |
| 10 | Cores da PWA | `theme-color` e `background_color`/`theme_color` do manifest seguem a nova paleta | o app instalado combina com a interface |

## Fora de escopo (decidido)
- Tema claro ou seguir o tema do sistema.
- Ícones novos do app.
- Mudanças de comportamento, de fluxo ou do modelo de dados (inclusive escolher a cor do livro).
- Reestruturar a navegação ou as telas.

## Em aberto
- nenhum
