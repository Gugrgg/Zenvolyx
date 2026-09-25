# Demo: clínica odontológica fictícia

A demo principal é a [Clínica Sorriso Demo](../../clients/odontologia-demo/README.md), uma clínica
odontológica fictícia, com foco em novos pacientes (D025). O paciente chama no WhatsApp; o
assistente entende o que ele quer, identifica o tratamento, tira dúvidas administrativas pela base
da clínica, confirma se é a primeira consulta, oferece horários livres de verdade, marca a
avaliação na agenda, registra tudo na planilha e confirma pelo WhatsApp. Pedido de atendente,
dúvida fora da base e relato de urgência vão para a equipe, sem diagnóstico (D026).

Cenários que a demo precisa cumprir: [demo-cenarios.md](demo-cenarios.md). Desenho geral:
[visao-geral.md](visao-geral.md). A config da própria Zenvolyx, que era a demo até a T036, fica
inativa para testes internos ([clients/zenvolyx](../../clients/zenvolyx/README.md)).

## O que a demo mostra, em poucos minutos

1. O paciente escreve do jeito dele ("oi, queria ver implante") e o assistente entende, com as
   perguntas em lista ou botões.
2. Dúvida administrativa (endereço, funcionamento, pagamento, como é a avaliação) é respondida pela
   base. Preço que não está na base não é inventado: o assistente explica que o valor sai na
   avaliação e segue para o agendamento.
3. Paciente novo escolhe um horário livre de verdade, e a avaliação aparece no Google Agenda.
4. O paciente aparece na planilha com tratamento, etapa e horário marcado.
5. Pedido para falar com uma pessoa, ou relato de dor forte ou inchaço, para a automação e chama a
   equipe, sem diagnóstico nem remédio.
6. Várias mensagens seguidas recebem uma resposta só.

## Roteiro da conversa

1. **Primeiro contato.** Envia `messages.welcome`, grava o lead no CRM (etapa `talking`) e faz a
   primeira pergunta. Se a primeira mensagem já responder a pergunta (ex.: "quero fazer um
   clareamento"), a IA registra a resposta e a conversa pula para a seguinte.
2. **Perguntas.** Pergunta com até 3 opções vai em botões; de 4 a 10, em lista. Resposta por
   botão é registrada direto. Texto livre passa pela IA (D019): `answer` registra a resposta,
   `reply` responde a dúvida antes de repetir ou seguir, e `urgent`, `human` e `stop` seguem o
   passo 6. Sem resposta, a pergunta é repetida; na segunda vez seguida, a equipe é chamada.
3. **Qualificação.** Com todas as respostas, as regras da config decidem:
   - não qualificado (na clínica da demo, quem já é paciente): `messages.notQualified`, CRM
     `not_qualified`, conversa encerrada;
   - qualificado: CRM `qualified` e agendamento.
4. **Agendamento (D018).** `messages.chooseSlot` e uma lista com até 9 horários de `listSlots`, mais
   a opção "Nenhum desses", que chama a equipe. Com o horário escolhido, `book`: deu certo,
   `messages.booked` (`{slot}` vira o horário) e CRM `scheduled`; horário ocupado nesse meio-tempo,
   `messages.slotTaken` e nova lista. Sem horário livre: `messages.noSlots` e equipe.
5. **Depois de encerrada.** Nova mensagem do lead passa pela IA sem pergunta pendente: dúvida da
   base é respondida; pedido de remarcar, cancelar ou falar com alguém chama a equipe.
6. **A qualquer momento.**
   - `urgent`: a conversa comercial para; `messages.urgent`, CRM `urgent` e pausa de 24 h (D026).
   - `human`: `messages.handoff`, CRM `with_team` e pausa de 24 h (D016).
   - `stop`: `messages.stopped`, recusa registrada, CRM `stopped` e pausa de 24 h.
   - As pausas vão para a tabela de pausas da entrada (D028).
   - Falha: `messages.failure` e equipe.

Na demo, chamar a equipe é deixar o lead na planilha com a etapa certa. O aviso por e-mail à
agência fica para depois da demo (T027); até lá, erros vão para log sem dados pessoais. O número de
teste não está no app WhatsApp Business (sem coexistência), então o dono faz o papel da equipe e
responde por outro canal. Com clientes em coexistência (D023), a equipe responde pelo próprio app.

## Estado da conversa (D020)

Uma tabela interna do n8n guarda, por cliente e BSUID: etapa, índice da pergunta atual, respostas
às perguntas da config, falhas seguidas, horários oferecidos, recusa e data da última interação.
Linhas sem interação há 30 dias são apagadas. Texto livre do lead não entra na tabela. A pausa fica
na tabela de pausas da entrada (D028).

## Preparação (dono)

Etapa 1, desenvolvimento e testes (custo só da IA):

- n8n no computador (T012) e túnel ligado durante os testes.
- App na Meta com o número de teste, e o seu celular cadastrado como destinatário de teste (T019).
- Projeto no Google Cloud com a conta de serviço (Sheets e Calendar); planilha `Leads` e agenda de
  demonstração da clínica compartilhadas com ela (T021, T022, T040; [passo a passo](../../integrations/crm/google-sheets/README.md#conta-de-serviço-do-google-dono-uma-vez)).
- Conta na Anthropic com chave da API e limite de gasto ([ia.md](ia.md)).
- Porta do WhatsApp da clínica criada à mão com o token da Zenvolyx
  ([passo a passo](../../integrations/whatsapp/client-gateway/README.md)).
- IDs preenchidos em `clients/odontologia-demo/config.json` e `active: true` (T030).

Etapa 2, prospects testando no próprio celular:

- Número próprio da Zenvolyx (ex.: um chip novo) registrado direto na Cloud API, sem o app, porque a
  coexistência exige Tech Provider (D023, [whatsapp-cadastro.md](whatsapp-cadastro.md)). As
  mensagens passam a ser cobradas (D007). Até lá, o dono mostra a demo no próprio celular ou em
  vídeo (B003).

## Tarefas até a demo

Já prontos: n8n local, verificações, leitura da config, porta do cliente, conector de WhatsApp e a
config da clínica (T012 a T018, T033, T037). Falta, na ordem do [TASKS.md](../../TASKS.md):

| Ordem | Claude | Codex | O quê |
|-------|--------|-------|-------|
| 1 | T019, T021 | T022, T039, T024 | entrada do WhatsApp e CRM; agenda, mensagens de urgência e de horário ocupado, IA com as regras de saúde |
| 2 | T020, T038, T040 | T028, T029 | rajadas e pausa, base da clínica e horários da demo; conversa e agendamento |
| 3 | | T041 | cenários em testes automáticos |
| 4 | T030, com o dono | | todos os cenários de ponta a ponta, com a IA de verdade |
| 5 | T042 | | roteiro de apresentação |

Com a T042 concluída, o desenvolvimento para e segue a fase comercial. Ficam para depois do
primeiro cliente fechado: avaliação automatizada da IA (T025), avisos (T027), produção (T032),
cadastro de clientes reais (T034, T035), lembretes (T023), áudio (T026), limpeza automática do
export (T031) e remarcação pelo WhatsApp (T043). A implantação do primeiro cliente (B012) exige
T025, T027, T032 e o cadastro do número dele.
