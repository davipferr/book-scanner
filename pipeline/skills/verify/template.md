---
step: verify
skill: verify
inputs:
  - docs/flow/03-prd.md
  - docs/flow/04-arquitetura.md
  - docs/flow/05-implementacao.md
---

# Verificação: <nome da feature>

**Veredito:** aprovado | reprovado

## Ambiente
- Cópia limpa em: <pasta temporária usada>
- Sistema e runtime: <ex.: Windows 11, Node 22.18>
- Instalação: `<comando>` → <ok | erro, com a saída>
- Build/typecheck/testes: `<comando>` → <resumo da saída>

## Funcionalidades (como usuário)
| Funcionalidade (mapa do 05) | CA | Comando / ação | Saída real (trecho) | ✅/❌ |
|-----------------------------|----|----------------|---------------------|-------|
| <nome> | CA-1 | `<comando exato>` | `<saída>` | ✅ |

## Bordas
| Caso | Comando / ação | Saída real (trecho) | ✅/❌ |
|------|----------------|---------------------|-------|
| entrada vazia | `<...>` | `<...>` | ✅ |

## Como repetir
Comandos para colar num terminal, a partir da raiz do repositório. Criam as entradas numa pasta temporária e não gravam nada na pasta do código.
```bash
t=$(mktemp -d)
printf '<entrada>' > "$t/<arquivo>"
<comando do programa> "$t/<arquivo>"   # esperado: <saída>
rm -rf "$t"
```

## Falhas
1. **<título>** — reproduzir: `<passos>` · esperado: <...> · obtido: <...> · causa: `<arquivo:linha>` <explicação> · etapa a refazer: implement

## Não verificado
- <o que não deu para verificar e por quê, ou "nada">
