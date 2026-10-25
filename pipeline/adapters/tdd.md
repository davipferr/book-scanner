# Adapter: `tdd` na etapa "implement"

A skill `tdd` (de mattpocock/skills) guia o ciclo vermelho → verde em fatias verticais. Ela pede que as interfaces a testar sejam combinadas com o usuário antes do primeiro teste. Neste pipeline isso já foi feito na arquitetura.

## Antes de chamar a skill

- Leia `docs/flow/04-arquitetura.md`. As **interfaces a testar** de lá são as que o `tdd` pede para combinar: mostre-as ao usuário e peça só a confirmação, sem rediscutir do zero.
- Siga as **fatias** na ordem do documento. Uma fatia = um ou mais ciclos vermelho → verde.
- Todo o código vai na pasta do código (`code` em `npm --prefix pipeline run --silent status -- --json`: `workspace` num projeto novo, `.` num projeto que já existia). Crie a pasta se não existir. Não mexa em `pipeline/`: ela é o pipeline, não o projeto.
- Se o `tdd` mencionar `GLOSSARY.md` ou ADRs, use `docs/flow/03-prd.md` e `docs/flow/04-arquitetura.md` no lugar deles.
- A pasta do código guarda **só o código do projeto** (fontes, testes, configuração). Registros do pipeline, como o mapa abaixo, vão em `docs/flow/05-implementacao.md`.
- A pasta do código precisa funcionar **sozinha**: nada de herdar configuração da pasta de cima ou de `pipeline/` (`"extends": "../tsconfig.json"`, `../node_modules`, caminhos absolutos). A etapa seguinte copia a pasta para fora do repositório e roda lá.
- Se a arquitetura tiver **Proibições**, cada uma vira uma checagem automática na primeira fatia em que fizer sentido (um teste que falha, uma regra de lint, um script). Proibição que só existe como texto não protege nada.
- Se a correção vier de uma **verificação reprovada** (`docs/flow/06-verificacao.md` com "Falhas"), cada falha vira uma fatia nova: primeiro um teste que reproduz a falha (vermelho), depois a correção (verde).

## O mapa de funcionalidades

Mantenha a seção `## Mapa de funcionalidades` de `docs/flow/05-implementacao.md` atualizada a cada fatia. É o mapa que a etapa `verify`, a skill `investigate` e qualquer agente futuro usam para operar o programa sem adivinhar. Formato:

~~~markdown
## Mapa de funcionalidades

### Instalar e rodar
- Requisitos: <runtime e versão>
- Instalar: `<comando>`
- Rodar: `<comando>`
- Testes: `<comando>` · Typecheck/build: `<comando ou "não há">`

### Funcionalidades
| Funcionalidade | Como acionar (comando, rota, tela → clique, atalho) | Código | CA |
|----------------|------------------------------------------------------|--------|----|
| <nome> | `<comando exato>` | `src/<arquivo>` › `<função>` | CA-1 |

### Entradas e saídas
- <formatos de arquivo, variáveis de ambiente, portas, onde grava>

### Erros conhecidos e códigos de saída
- <mensagem/código> → <quando acontece>
~~~

Se a interface for gráfica, a coluna "Como acionar" diz o caminho na tela (ex.: "Configurações → Conta → botão *Salvar* (`#save`)").

**Projeto que já existia** (`code` diferente de `workspace`): o projeto tem também o mapa permanente, `docs/FEATURE-MAP.md`, escrito pela skill `onboard`. Ao terminar a etapa, acrescente nele as funcionalidades novas e corrija as que mudaram (o mesmo conteúdo da seção acima, no formato daquele arquivo). A seção do `05-implementacao.md` vai embora com o `archive`; o `docs/FEATURE-MAP.md` fica.

## Depois de cada fatia

Rode os testes e acrescente a fatia em `docs/flow/05-implementacao.md`. Crie o arquivo na primeira fatia, com `status: in-progress` no cabeçalho:

~~~markdown
---
step: implement
skill: tdd
status: in-progress
inputs:
  - docs/flow/03-prd.md
  - docs/flow/04-arquitetura.md
---

# Implementação: <nome da feature>

## Como rodar os testes
```bash
cd <pasta do código> && <comando>
```

## Fatias
### 1. <nome da fatia> — CA-1
- Testes: `<pasta do código>/test/<arquivo>` › "<nome do teste>"
- Resultado: <n> passando
- Notas: <desvios da arquitetura e por quê, ou "nenhum">

## Mapa de funcionalidades
<no formato acima>

## Em aberto
- <...>
~~~

Enquanto o cabeçalho tiver `status: in-progress`, o `npm --prefix pipeline run status` mostra a etapa como **em andamento** (e não como pronta), mesmo com o arquivo já existindo. Assim dá para parar no meio e retomar depois.

A etapa só está pronta quando **todas** as fatias da arquitetura estão no arquivo, os testes passam e o "Mapa de funcionalidades" cobre todas as funcionalidades. Aí, e só aí, **remova a linha `status: in-progress`**.
