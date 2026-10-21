# Clínica Sorriso Demo (cliente da demo)

Clínica odontológica fictícia, cliente da demo principal (D025,
[docs/arquitetura/demo.md](../../docs/arquitetura/demo.md)). Nome, textos e dados são inventados e
não representam nenhuma clínica real. Formato da config: [clients/README.md](../README.md). Este
README guarda só informação técnica.

Foco em novos pacientes: o assistente identifica o tratamento, confirma se é a primeira consulta e
agenda a avaliação. Quem já é paciente recebe `messages.notQualified` e segue com a recepção.
Perguntas, regra e mensagens são uma proposta: o dono revisa antes de ativar.

## Agenda fictícia (T040)

A agenda separada **Clínica Sorriso Demo | Agenda fictícia** foi criada na conta Google do dono,
em `America/Sao_Paulo`. O ID está em `config.json`; ela não é pública. A config oferece blocos de
60 minutos com pelo menos 2 horas de antecedência, até 14 dias à frente: segunda a sexta das 9h
às 12h e das 13h às 18h, sábado das 9h às 12h. O intervalo das 12h às 13h não é ofertado.
`serviceQuestion: "procedure"` coloca o tratamento escolhido no título da reserva.

Para mostrar horários ocupados, há dois eventos **sem paciente real**, marcados como **Ocupado**,
sem convidados nem notificações: segunda-feira das 10h às 11h, a partir de 26/10/2026, e
quinta-feira das 14h às 15h, a partir de 22/10/2026. Cada série tem 13 ocorrências semanais;
renovar os bloqueios se a demo ocorrer depois desse período. Não mover esses eventos para a
agenda pessoal do dono.

### Ocupação ao vivo (cenário 4)

1. No celular, avançar com um lead inteiramente fictício até aparecer a lista de horários.
2. Escolher uma opção livre **futura** da lista, dentro do expediente. Anotar dia e hora no fuso
   de São Paulo, sem selecionar a opção ainda.
3. No Google Agenda do dono, abrir **Clínica Sorriso Demo | Agenda fictícia** e criar um evento
   de teste exatamente nesse intervalo de 60 minutos, sem convidados, com **Mostrar como:
   Ocupado**. Salvar e conferir que aparece na agenda.
4. Só então selecionar no celular a opção antiga. O conector deve retornar `slot_taken`; a conversa
   deve enviar `messages.slotTaken` e uma lista nova sem o horário ocupado. Selecionar outro horário
   livre e conferir a confirmação e o evento criado na agenda.
5. Depois da demonstração, remover apenas o evento temporário do passo 3. Não apagar uma reserva
   criada pela automação para simular outra tentativa.

Este roteiro depende da Calendar API, da credencial com escopo de agenda e do compartilhamento
com a conta de serviço. Esses acessos reais são verificados na T030; os testes de configuração não
comprovam as permissões do Google.

## Conectores

- IA da demo: [Gemini gratuito](../../integrations/ai/gemini/README.md), somente com
  mensagens fictícias e `ai.dataMode: "synthetic"` na config (D030/D031). A base administrativa
  foi preenchida na T038 com endereço, expediente, tratamentos, pagamentos, avaliação e política
  de preços fictícios. `ai.enabled` permanece `false` até o teste de ponta a ponta da T030.
  Não usar dados de pacientes reais.

- CRM: `google-sheets`, com a planilha `Leads` da demo compartilhada com a conta de serviço (T021).
- Agenda: `google-calendar`, com agenda de demonstração criada na T040. Compartilhamento com a
  conta de serviço e teste do conector real permanecem para a T030.
- WhatsApp: número de teste da Meta, com a porta criada à mão com o token da Zenvolyx
  ([passo a passo](../../integrations/whatsapp/client-gateway/README.md)).

## Ativação (T030)

- [ ] textos, regra e base revisados pelo dono
- [ ] `ai.enabled: true` somente durante o ensaio com pacientes inteiramente fictícios
- [ ] porta do WhatsApp criada e `gatewayWorkflowId` preenchido
- [ ] `phoneNumberId` e `spreadsheetId` preenchidos no lugar de `PREENCHER`; `calendarId` já foi preenchido na T040
- [ ] planilha e agenda compartilhadas com a conta de serviço
- [ ] `npm test` passando
- [ ] `active: true` e commit; a Zenvolyx fica inativa, porque as duas usariam o mesmo número de teste

## Particularidades

- Sem coexistência, "chamar a equipe" aparece na planilha, nas etapas "Com a equipe" e "Urgência";
  na demo, quem faz o papel da equipe é o dono.
- `messages.urgent` é o texto fixo da clínica para chamar a equipe e orientar pronto-socorro ou
  192 nos casos graves ([regra](../../docs/arquitetura/ia.md#urgência)); a IA não o escreve.
  `messages.slotTaken` pede outra escolha quando alguém ocupa o horário antes da reserva.
- Nada de preço de tratamento, promoção, "avaliação gratuita" ou condição de pagamento em tom de
  oferta: o Código de Ética Odontológica proíbe esse tipo de publicidade (art. 44, I). A IA só fala
  de pagamento quando perguntada (D026).
- Quem já é paciente aparece como "Não qualificado" na planilha, com a resposta "Já sou paciente".
  Na demo, a recepção fica sabendo só pela planilha.
