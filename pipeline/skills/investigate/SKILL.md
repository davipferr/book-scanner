---
name: investigate
description: Investiga um problema sem adivinhar - reproduz, lê o código real do caminho que falhou, testa a hipótese e só então afirma a causa, citando arquivo e linha. Use quando algo falhar (um teste, um comando, uma tela), quando o usuário relatar um bug (mesmo vago, como um print com "???"), ou quando as etapas verify ou review encontrarem uma falha.
---

# Investigar sem adivinhar

O erro mais caro de um agente é **afirmar uma causa que ele não verificou**: "provavelmente é o cache", "deve ser a versão do Node". Isso gera uma correção no lugar errado, que alguém (normalmente o dono do projeto) vai ter que desfazer. Esta skill troca palpite por evidência.

## Passos

1. **Reproduza antes de tudo.** Use o mapa do projeto, `docs/FEATURE-MAP.md` (num projeto que já existia), ou o "Mapa de funcionalidades" de `docs/flow/05-implementacao.md` (ou de `docs/runs/<execução>/05-implementacao.md`, numa execução arquivada; ou o README do projeto) para saber como acionar a funcionalidade. Escreva os passos mínimos que fazem o problema acontecer e rode-os. Guarde a saída real.
   - Relato vago? Use o mapa para chegar à tela ou ao comando mais provável e tente reproduzir. Se não conseguir, diga exatamente o que tentou; não invente o bug.
   - Não reproduziu? Pare aqui e reporte "não reproduzido", com o que foi tentado. Não "corrija" algo que você não viu falhar.

2. **Leia o código de verdade.** Siga o caminho da execução a partir do ponto de entrada (o mapa diz qual) até onde a saída diverge. Abra os arquivos; não deduza o conteúdo pelo nome. Leia também os testes que cobrem esse trecho.

3. **Escreva a hipótese com endereço.** "A causa é `src/x.ts:42`: `<o que o código faz>` quando `<condição>`." Sem arquivo e linha, ainda é palpite.

4. **Prove a hipótese.** Faça um experimento que só dá certo se ela for verdadeira: um teste mínimo que falha, um log temporário, uma entrada que contorna o trecho. Se o experimento contradiz a hipótese, volte ao passo 2.

5. **Deixe um teste vermelho** que reproduz o problema, quando o projeto tiver testes. Ele é a prova e o critério de "corrigido".

6. **Reporte** neste formato (dentro do artefato da etapa que chamou, ou na conversa se foi o usuário):

   ```markdown
   ### <título curto do problema>
   - Reproduzir: `<passos/comandos>`
   - Esperado: <...> · Obtido: `<saída real>`
   - Causa: `<arquivo:linha>` — <explicação>
   - Prova: <experimento feito e resultado>
   - Teste que reproduz: `<arquivo>` › "<nome>" (ou "não há testes no projeto")
   - Correção sugerida: <o quê, onde>
   ```

## Regras

- Não corrija durante a investigação, a não ser que o usuário peça. Dentro do pipeline, quem corrige é a etapa `implement`.
- "Não sei" com o que foi tentado vale mais que uma causa inventada.
- Remova logs e arquivos temporários usados no experimento (o teste vermelho do passo 5 fica).
