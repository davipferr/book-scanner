# Mapa de funcionalidades: <nome do projeto>

O mapa do projeto: como instalar e rodar, como acionar cada funcionalidade, onde está o código e qual teste a cobre. Um agente que for mexer no projeto, verificar uma entrega ou investigar um bug começa por aqui, em vez de adivinhar. Caminhos a partir da raiz do repositório. Escrito pela skill `onboard`; a etapa `implement` do pipeline o mantém em dia.

## Instalar e rodar
- Requisitos: <runtimes e versões, serviços (banco, fila), variáveis de ambiente obrigatórias>
- Instalar: `<comando>`
- Rodar: `<comando>` → <o que aparece: porta, janela, saída>
- Testes: `<comando>` → <n> passando
- Build/typecheck/lint: `<comando ou "não há">`

## Funcionalidades
| Funcionalidade | Como acionar (comando, rota, tela → clique, atalho) | Código | Teste |
|----------------|------------------------------------------------------|--------|-------|
| <nome> | `<comando exato>` | `<arquivo>` › `<função>` | `<arquivo de teste>` › "<nome>" ou — |

## Entradas e saídas
- <formatos de arquivo, variáveis de ambiente, portas, onde grava, serviços externos>

## Erros conhecidos e códigos de saída
- <mensagem/código> → <quando acontece>

## Skills do projeto
Além das skills do pipeline. Buscas feitas com a `find-skills`: `<busca>`, `<busca>`.

| Skill | Fonte | Quando usar |
|-------|-------|-------------|
| <nome> | `<owner/repo>` ou `pipeline/skills/` | <tarefa deste projeto em que ela ajuda> |
