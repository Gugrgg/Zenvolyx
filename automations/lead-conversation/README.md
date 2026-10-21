# Conversa e agendamento com leads (T028/T029)

Máquina de estados sobre uma Data table, com perguntas da config, regras de
qualificação, agenda, CRM, mensagens do WhatsApp e pausa de 24 horas. ID `leadConversation`.
O arquivo `conversation.js` contém as funções puras embutidas nos nós Code;
`conversation.d.ts` descreve os contratos para os testes.

Ligada à saída **Burst event** da entrada do WhatsApp. Gemini é chamado somente
com `ai.enabled: true` e `ai.dataMode: "synthetic"` na config versão 3 (D031).
A indicação não anonimiza texto: usar exclusivamente na demo com dados fictícios.
Sem ela, o fluxo segue com botões e comandos explícitos, sem chamada de IA nem
fallback pago. A base administrativa fictícia está na config da clínica (T038).

## Entrada e estado

Execute Workflow, fonte Database, Run once for each item. Entrada: um item
`{ event, config }`, no formato da saída **Burst event** de
[whatsapp-inbound](../whatsapp-inbound/README.md#saída). Evento e campos usados
da config são validados antes de acessar tabelas ou conectores. Config inativa
é recusada. Exemplo completo: [input.json](../../tests/fixtures/conversation/input.json).

`lead_conversations`: `clientId`, `leadId` (BSUID), `stateJson` e `lastContactAt`.
O JSON guarda etapa, índice da pergunta, respostas administrativas, falhas seguidas,
horários oferecidos, recusa, agendamento e primeiro/último contato. Não guarda
mensagem original, nome, telefone ou resposta gerada. Linhas com mais de 30 dias
sem interação são removidas diariamente às 3h20 no fuso da instância.

Estado é separado por cliente e lead. Estado inválido ou duplicado encaminha à
equipe; uma falha de leitura/gravação interrompe o envio. O fluxo confere novamente
`whatsapp_lead_pauses` antes dos efeitos, para respeitar uma pausa iniciada enquanto
a mensagem era processada. A pausa usa a tabela existente e as regras da D028.

`lead_conversation_turns` ordena execuções por cliente/lead, pelo ID crescente
da reserva. Guarda apenas `clientId`, `leadId` e `owner` (ID técnico da execução).
Uma execução espera em memória até 10 minutos e libera sua reserva ao concluir,
inclusive nas falhas tratadas. Outros leads seguem independentemente. Após uma
interrupção abrupta, a reserva é ignorada depois de 30 minutos e removida na
limpeza diária. A pausa é conferida novamente ao assumir a vez. Não é uma fila
durável: reiniciar o n8n pode perder mensagens em processamento (limite da demo).

## Comportamento

- Primeiro contato: CRM `talking`, boas-vindas e primeira pergunta. Resposta inicial
  reconhecida pela IA avança diretamente para a seguinte.
- Até três opções: botões; quatro a dez: lista com `Ver opções`. IDs incluem
  pergunta e opção (`procedure:implant`), rejeitando botões de outra pergunta.
  Uma rajada com texto adicional não é tratada como mero clique.
- Resposta válida zera as falhas. Duas falhas consecutivas encaminham à equipe.
  Número pode ser lido diretamente; texto administrativo é resumido pela IA,
  nunca copiado bruto para o estado.
- Qualificação usa todas as regras da config. CRM recebe o estado completo no
  primeiro contato e a cada mudança de etapa; falha do CRM não impede a resposta.
- `urgent` e `stop` descartam texto gerado, usam mensagens fixas e pausam por 24 h.
  `human`, mídia e falhas repetidas encaminham à equipe. Recusa fica no estado e
  no CRM. Novo contato entregue após a pausa pode recomeçar a conversa (D028).
- Sem agenda, qualificado vai para a equipe. Com agenda, consulta `calendarRouter01`
  com a config do cliente e pede até nove horários, mais **Nenhum desses**.
  Essa opção chama a equipe; agenda sem opções usa `messages.noSlots` e pausa.
- A escolha é um clique isolado na lista, com ID e rótulo correspondentes ao
  intervalo guardado em `offeredSlots`. O ID contém início e fim, impedindo que
  uma opção antiga aponte para outro horário depois de atualizar a lista.
  Texto livre e datas sugeridas pela IA não criam reservas; dúvida administrativa
  recebe resposta e a lista reaparece. Texto adicional na rajada passa pela IA
  antes de qualquer ação, preservando a prioridade de urgência, parada e equipe.
- `book` recebe o intervalo guardado, identificação mínima do lead e o rótulo
  da opção indicada por `scheduling.serviceQuestion` (ou serviço nulo).
  Sucesso grava `appointment`, CRM `scheduled` e envia `messages.booked` com
  `{slot}` substituído pelo rótulo no fuso do cliente. Não mantém o ID externo
  do evento nem envia respostas de qualificação à agenda.
- `slot_taken` limpa a oferta antiga e consulta novamente uma única vez,
  usando `messages.slotTaken` com a nova lista. Escolha expirada também pede
  horários novos. Falha, saída inválida ou conflito encaminha para a equipe com
  `messages.failure`, sem confirmar reserva.
- A pausa é conferida antes da chamada e novamente depois da resposta da agenda.
  Se a equipe assumir durante a chamada, uma reserva já concluída ainda é
  persistida e enviada ao CRM, mas nenhuma resposta automática é enviada.
- Falha de envio registra erro, pausa e atualiza o CRM para a equipe; urgência e
  recusa conservam suas etapas. Não tenta enviar outra mensagem no mesmo erro.

O nó **Report** concentra logs com evento, código e clientId; sem BSUID, telefone,
nome ou texto. A T027 acrescentará o aviso. Persistência de execuções, inclusive
erros e manuais, permanece desligada. A entrada também mantém essas opções desligadas.

## Instalação e publicação

1. Importar `workflow.json` e abrir **Lead conversation** no editor do n8n.
2. Publicar os conectores `whatsappCloudApi`, `crmUpsertRouter1` e
   `aiGeminiDemo0001` e `calendarRouter01` (com `googleCalendar01`), conforme seus READMEs.
3. Clicar em **Publish** no editor da conversa; depois importar e publicar a
   entrada do WhatsApp preservando suas referências à credencial Crypto.
4. Exportar os dois workflows, remover credenciais e metadados da instância
   (D022) e executar `npm run check:workflows`.

As tabelas são criadas automaticamente. Após reimportação, publicar pelo editor
e verificar a versão ativa (T045). Não habilitar faturamento para estes testes.

## Verificação

`npm test -- tests/lead-conversation.test.ts tests/conversation-scheduling.test.ts` verifica transições, isolamento,
regras, fallback, estados encerrados e minimização de dados, sem rede.

`npm test -- tests/demo-scenarios.test.ts` percorre os 12 cenários da demo e três
variações de urgência, executando os nós Code e as conexões do export com tabelas
em memória e todos os conectores simulados. Fixtures, cobertura e limites no
[roteiro de cenários](../../docs/arquitetura/demo-cenarios.md#testes-automáticos-t041).
Não exige n8n nem chama APIs; não substitui o ensaio real da T030.

Ensaio em n8n 2.40.5 descartável, acessível somente em loopback, com tabelas reais
e conectores substituídos por respostas fictícias; um workflow chamador usa
Execute Workflow para exercitar a conversa como sub-workflow:

1. Enviar a fixture; conferir CRM `talking`, boas-vindas e lista.
2. Enviar `procedure:implant` e depois `patient:new`; conferir respostas persistidas,
   CRM `qualified`/`with_team`, mensagem fixa e pausa.
3. Repetir enquanto pausado: nenhum envio nem alteração do estado.
4. Em leads distintos, simular `urgent`, `stop`, `human`, falha da IA duas vezes,
   falha de CRM, markRead e envio; conferir etapas, pausas e logs.
5. Simular paciente recorrente e depois dúvida administrativa: estado permanece
   encerrado e a resposta não reabre o questionário.
6. Inserir estados fictícios com 40 dias e 1 dia; executar a limpeza e conferir
   que apenas o recente permanece.

7. Atrasar a primeira interpretação e enviar outra resposta do mesmo lead:
   conferir perguntas/respostas em sequência, sem sobrescrita. Um segundo lead
   deve continuar durante a espera. Confirmar que pausas e falhas liberam a vez.
8. Tirar `dataMode` ou desligar `enabled`: nenhum nó de IA pode executar.

Validação em 2026-10-01: 16 requisições funcionais e 8 adicionais de concorrência,
autorização da IA e pausa passaram, além da limpeza por idade.
Os dois workflows foram publicados no n8n local pelo editor, com a versão ativa
conferida contra o export. Uma chamada Execute Workflow confirmou a validação
da entrada publicada, sem alcançar conectores; o verificador foi arquivado.
Sem Meta, Google Sheets ou Gemini reais neste ensaio. Teste integrado pelo celular
fica na T030, com dados fictícios e os recursos configurados pelo dono.

### Agendamento (T029)

Fixture com agenda: [scheduling.json](../../tests/fixtures/conversation/scheduling.json).
Usar datas futuras na resposta simulada de listSlots; não ativar a clínica nem
chamar serviços reais para estes ensaios.

1. Qualificar um lead fictício: conferir consulta com limit 9, opções guardadas
   no estado e lista de até dez linhas incluindo Nenhum desses.
2. Selecionar horário: conferir book com intervalo guardado e serviço da config;
   só após ok/eventId devem aparecer confirmação e CRM scheduled.
3. Simular slot_taken, fornecer outra lista e escolher novamente. O horário
   antigo não pode reservar outra opção; a mensagem inclui slotTaken.
4. Simular lista vazia, Nenhum desses, auth, event_conflict e falha na relistagem:
   conferir mensagem fixa, CRM with_team e pausa, sem confirmação.
5. Simular horário seguido de urgência na mesma rajada: nenhum book, texto fixo
   urgent e pausa. ID inventado ou texto com data também não pode reservar.
6. Falha de CRM não impede confirmação; falha de envio preserva appointment,
   encaminha para equipe e não cria outra reserva. Nova mensagem após scheduled
   não repete book.
7. Atrasar book e inserir pausa team durante a chamada: appointment e CRM
   ficam gravados, mas a confirmação não é enviada.

Validação em 2026-10-08: 600 testes automáticos (38 de agendamento), 12 cenários
de agendamento no n8n com 48 requisições, mais regressão da conversa e da fila
por lead, todos com conectores simulados. Sem chamadas pagas ou dados reais.
Publicado no n8n local pelo editor na mesma data; o export da versão publicada
confirmou os 82 nós, conexões e configurações iguais ao código testado.

### Limites

Gravação na agenda e na tabela de estado não formam uma transação. Se houver
interrupção após book, repetir o mesmo pedido usa a identidade estável do
conector (T022); erro incerto vai para a equipe, sem cancelar nem marcar outro
horário automaticamente. Reservas entre leads diferentes continuam sujeitas à
concorrência da T044. Remarcação e cancelamento seguem para equipe até a T043.
Agenda/config da demo foram preparadas na T040; permissões do Google e ensaio
real permanecem na T030. O teste simulado não confirma esses acessos.
