---
name: verify
description: Usa o que foi implementado (na pasta do código do projeto) como um usuário de verdade (roda os comandos, abre a tela, monta entradas reais e casos de borda) numa cópia fora do repositório, e grava as provas e os comandos para repetir a verificação em docs/flow/06-verificacao.md, sem deixar nenhum arquivo no código do projeto. Use quando o usuário pedir para testar, verificar ou "ver se funciona de verdade" o que foi implementado, ou quando o run-pipeline estiver na etapa "verify".
---

# Verificar como um usuário

**Entradas:** `docs/flow/03-prd.md`, `docs/flow/04-arquitetura.md`, `docs/flow/05-implementacao.md` (com a seção "Mapa de funcionalidades")
**Saída:** `docs/flow/06-verificacao.md`

Testes passando não provam que o programa funciona: provam que os testes passam. Esta etapa existe para que **ninguém precise rodar o programa à mão** para descobrir que ele quebra. Você é o primeiro usuário: se algo não funciona, é você quem descobre, não o dono do projeto.

Você **não corrige o código** aqui. Achou um problema, reproduza, entenda e registre. A correção volta para a etapa de implementação.

O código está na pasta do código (`code` em `npm --prefix pipeline run --silent status -- --json`: `workspace` num projeto novo, `.` num projeto que já existia), que guarda **só o código do projeto**. Tudo o que esta etapa produz (provas, comandos, observações) vai em `docs/flow/06-verificacao.md`.

## Passos

1. **Leia o mapa.** A seção "Mapa de funcionalidades" de `docs/flow/05-implementacao.md` diz como instalar, como rodar e onde está cada funcionalidade. Se ela não existir ou estiver errada (um comando que não funciona, uma tela que não existe), isso já é uma falha: registre e reprove. Num projeto que já existia, leia também o `docs/FEATURE-MAP.md` (o mapa do código anterior, escrito pela skill `onboard`) e confira se as funcionalidades novas entraram nele.

2. **Rode numa cópia limpa.** Copie a pasta do código para uma pasta temporária **fora deste repositório** (sem `node_modules`, sem arquivos gerados; se a pasta do código for `.`, sem `pipeline/`, `docs/`, `.git/`, `.claude/` e `.agents/`) e trabalhe lá. Instale as dependências e rode os comandos de build, typecheck e testes que o mapa indica. Isso pega o que só funciona por acidente: arquivo que herda configuração da pasta de cima, dependência instalada só na sua máquina, caminho absoluto.

3. **Use cada funcionalidade do mapa como um usuário.**
   - Monte entradas reais na pasta temporária: os exemplos do PRD, um arquivo do tamanho que um usuário teria, texto com acentos.
   - Rode o comando de verdade (não a função do teste), ou suba o servidor e faça as requisições, ou abra a tela. Para interface gráfica, use a automação de navegador que você tiver (a ferramenta de navegador do seu agente, ou Playwright se o projeto já o usar). Se não tiver nenhuma, diga isso no artefato em vez de fingir que olhou.
   - Para cada critério de aceite com comportamento observável, guarde o **comando exato** e a **saída real** (um trecho, não um resumo seu).

4. **Procure as bordas.** Pelo menos: entrada vazia, entrada inválida, arquivo inexistente, caminho com espaço, texto com acentos e quebra de linha do Windows (CRLF), volume grande o bastante para notar lentidão. Inclua outras que o PRD e a arquitetura sugerirem.

5. **Quando algo falhar, não adivinhe.** Use a skill `investigate`: reproduza, leia o código do caminho que falhou e só então escreva a causa, citando arquivo e linha. Registre no artefato com os passos para reproduzir.

6. **Escreva como repetir.** Na seção "Como repetir" do artefato, deixe os comandos que refazem o essencial da verificação, prontos para colar num terminal: criam as entradas numa pasta temporária, rodam o programa e dizem a saída esperada. Rode-os você mesmo na cópia limpa antes de gravar. É assim que a revisão, outro agente ou o dono repetem a verificação sem reconstruir nada.

7. Escreva `docs/flow/06-verificacao.md` a partir de [template.md](template.md). O veredito é **aprovado** só se a instalação limpa funcionou, os comandos de "Como repetir" deram a saída esperada e nenhuma funcionalidade falhou. "Não deu para verificar" não é aprovação: liste em "Não verificado", com o motivo, e o ship-report vai cobrar isso.

## Regras

- Prova é comando + saída. "Funcionou" sem saída colada não conta.
- **Não grave nada na pasta do código** nem em `pipeline/`: nem script, nem arquivo de entrada, nem anotação. Entradas de teste ficam na pasta temporária.
- Não edite `docs/flow/05-implementacao.md` nem o código. Problema encontrado (inclusive no mapa) vira item em "Falhas", e o run-pipeline manda de volta para a implementação.
- Apague a cópia temporária no fim.
