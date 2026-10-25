# Evals: testes para skills

Uma skill muda, e pode piorar sem ninguém perceber. Cada pasta aqui guarda **casos** de uma skill, que a skill `eval-skill` roda num agente sem contexto e julga pelos critérios.

```
pipeline/evals/
└── <nome-da-skill>/
    └── <caso>/
        ├── caso.md        # pedido, critérios e nota mínima (o executor NÃO vê)
        └── arquivos/      # o que o executor encontra na pasta (a situação inicial)
```

Aqui ficam só os **casos**, porque eles são o teste: rodar o mesmo caso antes e depois de mudar uma skill é o que mostra se ela melhorou ou piorou. As notas não são gravadas: a `eval-skill` as mostra na conversa, e o histórico das mudanças fica no git.

## O `caso.md`

```markdown
# <nome do caso>

## Pedido
<exatamente o que o executor recebe como prompt, como um usuário diria>

## Critérios
| # | Critério | Peso |
|---|----------|------|
| 1 | <algo verificável no que o executor produziu> | 2 |
| 2 | <...> | 1 |

## Nota mínima
8
```

## Bons critérios

- **Verificáveis no resultado.** "Todo CA tem entrada e saída concretas" dá para conferir; "o PRD é bom" não dá.
- **Ligados a falhas reais.** O melhor caso nasce de algo que deu errado numa execução (veja a skill `harden`).
- **Incluem o que a skill NÃO deve fazer.** Ex.: "não inventa requisito que não está na ideia nem nas decisões".

## Como rodar

Peça ao agente: *"avalie a skill write-prd"* (skill `eval-skill`). Funciona em qualquer agente com suporte a skills. O resultado (notas, quem executou e quem julgou) aparece na conversa.

O fluxo é sempre o mesmo:

1. O agente procura casos em `pipeline/evals/<skill>/`.
2. **Se não houver nenhum**, ele não roda nada ainda: primeiro te ajuda a escrever um caso, mostra o `caso.md` e os `arquivos/` propostos e só grava depois da sua aprovação.
3. Com os casos prontos, ele executa cada um num agente sem contexto, dá a nota e, se ficar abaixo do mínimo, propõe melhorias no `SKILL.md`.
4. Nas próximas vezes, os casos já existem: o passo 2 é pulado e a skill é medida sempre pelo mesmo teste.

## Exemplo: avaliar uma skill que ainda não tem caso

Hoje só a `write-prd` tem caso. Para avaliar a `capture-idea`, peça *"avalie a skill capture-idea"*. O agente vai propor casos tirados das regras do próprio `SKILL.md` dela, por exemplo:

**`pipeline/evals/capture-idea/ideia-completa/`**
- Pedido: uma mensagem com problema, público e uma restrição. Ex.: *"Eu esqueço quanto gastei no mês até a fatura chegar. Quero um jeito de lançar os gastos pelo celular e ver o total do mês. Precisa funcionar offline."*
- `arquivos/`: vazio (a skill não lê arquivos).
- Critérios:
  1. Grava `docs/flow/01-ideia.md` com o cabeçalho `step: idea`, `skill: capture-idea`, `inputs: []`.
  2. Separa problema, ideia, restrições e dúvidas.
  3. Não propõe arquitetura, stack nem telas.
  4. Não inventa requisito que não estava na mensagem.
  5. Não faz pergunta (o problema e o público já estavam na mensagem).

**`pipeline/evals/capture-idea/ideia-ja-existe/`**
- Pedido: uma ideia nova qualquer.
- `arquivos/`: um `docs/flow/01-ideia.md` antigo.
- Critério principal: a skill para e pergunta antes de substituir, e o arquivo antigo fica intacto.

## Skills que fazem perguntas

Algumas skills perguntam ao usuário (a `capture-idea` pode fazer até duas perguntas; `grilling` e `tdd` são interativas). O executor da avaliação não tem ninguém para responder, então:

- **Prefira casos em que a pergunta não é necessária**: o pedido já traz o que a skill precisa.
- **Quando o caso é justamente sobre perguntar**, o critério mede se ela perguntou certo: quantas perguntas fez, se eram sobre o que faltava e se **não** gravou uma resposta inventada no lugar.
