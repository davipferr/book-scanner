---
step: grill
skill: grilling
inputs:
  - docs/flow/01-ideia.md
---

# Decisões: Contador de palavras

## Decisões
| # | Pergunta | Decisão | Por quê |
|---|----------|---------|---------|
| 1 | Linguagem e runtime? | TypeScript rodando direto no Node 22.18+ | Já está instalado; sem etapa de build |
| 2 | Dependências externas? | Nenhuma | Problema pequeno; a biblioteca padrão resolve |
| 3 | Entrada: arquivo ou stdin? | Os dois: arquivo se passado, senão stdin | Permite `cat texto.md \| contador` |
| 4 | "Casa" e "casa" são iguais? | Sim, só no ranking de frequência | É o que importa para achar repetição |
| 5 | O que é uma palavra? | Sequência de letras/números de qualquer idioma; hífen e apóstrofo no meio fazem parte | "pé-de-moleque" é uma palavra |
| 6 | Quantas palavras no ranking? | Só com `--top N`; sem a flag, nenhum ranking | Saída curta por padrão |
| 7 | Arquivo inexistente? | Mensagem clara e código de saída 1 | Dá para usar em scripts |

## Fora de escopo (decidido)
- Ignorar palavras comuns ("de", "a", "o")
- Ler .docx ou PDF
- Interface gráfica

## Em aberto
- nenhum
