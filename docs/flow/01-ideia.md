---
step: idea
skill: capture-idea
inputs: []
---

# Ideia: redesign visual do Book Scanner

## Problema
A interface do Book Scanner parece genérica, como qualquer app feito a partir de um template (tema escuro padrão, fonte do sistema, superfícies cinza, acento amarelo). Nada nela remete a livros, leitura ou estudo, e o app não tem identidade própria.

## Ideia
Um redesign visual distinto da interface do Book Scanner (`index.html` + `src/style.css`), guiado pela skill `frontend-design`: direção estética, tipografia, paleta e layout próprios, que não pareçam um template.

## Para quem
O próprio usuário, que usa o app como ferramenta pessoal para escanear e estudar os próprios livros no celular.

## Restrições já conhecidas
- Usar a skill `frontend-design` para guiar as escolhas visuais.
- O app continua sendo um site estático (PWA no GitHub Pages), sem servidor, que funciona offline.
- Nenhum prazo informado.

## Em aberto
- Só a aparência muda, ou também o layout e o fluxo das telas (biblioteca, scanner, páginas, leitor, diálogos)?
- Qual direção estética? E o tema: só escuro, claro e escuro, ou o do sistema?
- Fontes customizadas podem ser baixadas e embutidas, ou devem continuar sem dependência externa? (o app precisa funcionar offline)
- Ícones, manifest e cor de tema da PWA também entram no redesign?
- A acessibilidade (contraste, foco, alvos de toque) entra como critério de aceite, conferido com a skill `accessibility`?
- O scanner (view da câmera) entra no redesign ou continua neutro e escuro para não atrapalhar a captura?
