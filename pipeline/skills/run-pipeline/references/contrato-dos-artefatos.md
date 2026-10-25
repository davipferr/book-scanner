# Contrato dos artefatos

Todo arquivo que uma etapa grava em `docs/flow/` é um **artefato**: o bastão que ela entrega para a próxima. Para que qualquer agente (Claude, Codex, ChatGPT) consiga continuar o trabalho, todo artefato segue o mesmo formato.

## Base, produto e a pasta do código

Os artefatos são **produto** da execução: ficam em `docs/flow/` (e, arquivados, em `docs/runs/`), nunca dentro de `pipeline/`. O código do projeto também é produto e fica na **pasta do código**: o `code` do `pipeline/flow.yaml`, que o `status -- --json` informa. Num projeto novo é `workspace`; num projeto que já existia, `.` (o próprio repositório). Quando um artefato ou uma skill fala em "pasta do código", é ela.

## Cabeçalho obrigatório

```markdown
---
step: prd                      # id da etapa no flow.yaml
skill: write-prd               # skill que produziu o arquivo
inputs:                        # arquivos lidos para produzi-lo
  - docs/flow/01-ideia.md
  - docs/flow/02-decisoes.md
---

# Título do artefato
...
```

## Regras

1. **Um artefato, um dono.** Só a etapa listada em `step` escreve neste arquivo. Outras etapas leem.
2. **Autossuficiente.** Quem lê o artefato não teve acesso à sua conversa. Se uma decisão importa, ela está escrita aqui.
3. **Referencie, não copie.** Se a informação já está num artefato anterior, cite o arquivo em vez de repetir o conteúdo.
4. **Pendências explícitas.** O que ficou em aberto vai numa seção `## Em aberto`, nunca fica implícito.
5. **Prova, não afirmação.** Quando o artefato diz que algo funciona, ele mostra o que prova isso: o comando rodado e um trecho da saída real, ou o teste (arquivo e nome).
6. **Veredito.** Etapas com `on_reject` no `flow.yaml` (verificação e revisão) têm, no corpo, a linha `**Veredito:** aprovado` ou `**Veredito:** reprovado` (pode vir uma observação depois). Sem ela, o artefato está fora do contrato.
7. **Trabalho pela metade.** Uma etapa longa (como a implementação) pode gravar o artefato aos poucos. Enquanto não terminar, o cabeçalho leva `status: in-progress`; quando terminar, a linha é removida.

## Como o estado é calculado

O `npm --prefix pipeline run status` não guarda estado em lugar nenhum: ele olha os arquivos. E confere o que dá para conferir por script (o cabeçalho e o veredito): isso não depende de ninguém lembrar.

| Estado    | Significado                                                        |
|-----------|--------------------------------------------------------------------|
| `done`    | todas as saídas existem e são mais novas que as entradas            |
| `stale`   | as saídas existem, mas alguma entrada foi alterada depois delas (ou a etapa que produz a entrada está desatualizada) |
| `in-progress` | as saídas existem, mas alguma ainda tem `status: in-progress` no cabeçalho |
| `invalid` | as saídas existem, mas não seguem o contrato (cabeçalho ausente ou diferente do `flow.yaml`, ou sem veredito) |
| `rejected` | o veredito é **reprovado**: o JSON traz `redo`, a etapa a refazer |
| `ready`   | as saídas não existem e todas as entradas existem                   |
| `blocked` | falta alguma entrada, ou a etapa que a produz está em andamento, inválida ou reprovada |

É a mesma ideia do `make`: se você editar o PRD à mão, a arquitetura e tudo que vem depois ficam `stale`.
