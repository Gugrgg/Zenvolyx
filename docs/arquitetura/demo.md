# Demo da Zenvolyx

A demo é a própria Zenvolyx como primeiro cliente: um dono de negócio chama no WhatsApp da
Zenvolyx, a IA conversa e qualifica, a automação marca uma apresentação na agenda e registra o
lead na planilha. Config: [clients/zenvolyx](../../clients/zenvolyx/README.md). Desenho geral:
[visao-geral.md](visao-geral.md).

## O que a demo mostra

1. Mensagem escrita do jeito do lead é entendida pela IA, com as perguntas em botões e listas.
2. Dúvida sobre a Zenvolyx é respondida pela base; pergunta de preço vai para a equipe, porque a
   IA não inventa o que não está na base.
3. Lead qualificado escolhe um horário livre de verdade, e o evento aparece no Google Agenda.
4. O lead aparece na planilha com respostas, etapa e agendamento.
5. Pedido de atendente pausa a automação para aquele lead.
6. Várias mensagens seguidas recebem uma resposta só.

## Roteiro da conversa

1. **Primeiro contato.** Envia `messages.welcome`, grava o lead no CRM (etapa `talking`) e faz a
   primeira pergunta. Se a primeira mensagem já responder a pergunta (ex.: "tenho uma clínica"), a
   IA registra a resposta e a conversa pula para a seguinte.
2. **Perguntas.** Pergunta com até 3 opções vai em botões; de 4 a 10, em lista. Resposta por
   botão é registrada direto. Texto livre passa pela IA (D019): `answer` registra a resposta,
   `reply` responde a dúvida antes de repetir ou seguir, `human` chama a equipe, `stop` encerra.
   Sem resposta, a pergunta é repetida; na segunda vez seguida, a equipe é chamada.
3. **Qualificação.** Com todas as respostas, as regras da config decidem:
   - não qualificado: `messages.notQualified`, CRM `not_qualified`, conversa encerrada;
   - qualificado: CRM `qualified` e agendamento.
4. **Agendamento (D018).** `messages.chooseSlot` e uma lista com até 9 horários de `listSlots`, mais
   a opção "Nenhum desses", que chama a equipe. Com o horário escolhido, `book`: deu certo,
   `messages.booked` (`{slot}` vira o horário) e CRM `scheduled`; horário ocupado nesse meio-tempo,
   nova lista. Sem horário livre: `messages.noSlots` e equipe.
5. **Depois de encerrada.** Nova mensagem do lead passa pela IA sem pergunta pendente: dúvida da
   base é respondida; pedido de remarcar, cancelar ou falar com alguém chama a equipe.
6. **A qualquer momento.** `human`: `messages.handoff`, CRM `with_team`, pausa de 24 h (D016) e
   aviso à agência. `stop`: `messages.stopped` e recusa registrada. Falha: `messages.failure` e
   equipe.

Na demo, o número não está no app WhatsApp Business (sem coexistência), então "chamar a equipe" é
o aviso à agência: o dono vê o contato na planilha e responde por outro canal. Com clientes em
coexistência (D015), a equipe responde pelo próprio app.

## Estado da conversa (D020)

Uma tabela interna do n8n guarda, por cliente e BSUID: etapa, índice da pergunta atual, respostas
às perguntas da config, falhas seguidas, horários oferecidos, pausa, recusa e data da última
interação. Linhas sem interação há 30 dias são apagadas. Texto livre do lead não entra na tabela.

## Preparação (dono)

Etapa 1, desenvolvimento e testes (custo só da IA):

- n8n no computador (T012) e túnel ligado durante os testes.
- App na Meta com o número de teste, e o seu celular cadastrado como destinatário de teste (T019).
- Projeto no Google Cloud com a conta de serviço (Sheets e Calendar); planilha `Leads` e agenda da
  Zenvolyx compartilhadas com ela (T021, T022).
- Conta na Anthropic com chave da API e limite de gasto ([ia.md](ia.md)).
- E-mail que recebe os avisos da agência (T027).
- IDs preenchidos em `clients/zenvolyx/config.json` e `active: true`.

Etapa 2, mostrar para prospects:

- Número próprio da Zenvolyx (ex.: um chip novo) registrado direto na Cloud API, sem o app, porque a
  coexistência exige Tech Provider (D015, T017). As mensagens passam a ser cobradas (D007).

## Tarefas até a demo

| Ordem | Tarefas | Quem | O quê |
|-------|---------|------|-------|
| 1 | T012 | Codex | n8n local |
| 2 | T013, T014, T015 | Codex | verificações: workflows exportados, lint no Windows, configs |
| 3 | T016, T018, T021, T022, T024, T027 | Codex | config do cliente, conectores (WhatsApp, CRM, agenda, IA) e avisos |
| 4 | T019, T020 | Codex | entrada do WhatsApp, rajadas e pausa |
| 5 | T028 | Codex | conversa e qualificação |
| 6 | T029 | Codex | agendamento na conversa |
| 7 | T025 | Codex | avaliação da IA |
| 8 | T030 | Claude e dono | teste de ponta a ponta e roteiro de apresentação |

Ficam fora da demo: clientes reais no WhatsApp (T017), lembretes (T023) e áudio (T026).
