# Clínica Sorriso Demo (cliente da demo)

Clínica odontológica fictícia, cliente da demo principal (D025,
[docs/arquitetura/demo.md](../../docs/arquitetura/demo.md)). Nome, textos e dados são inventados e
não representam nenhuma clínica real. Formato da config: [clients/README.md](../README.md). Este
README guarda só informação técnica.

Foco em novos pacientes: o assistente identifica o tratamento, confirma se é a primeira consulta e
agenda a avaliação. Quem já é paciente recebe `messages.notQualified` e segue com a recepção.
Perguntas, regra e mensagens são uma proposta: o dono revisa antes de ativar.

## Em construção

A config já passa no validador, mas a demo ainda precisa destas partes:

| Tarefa | O que entra |
|--------|-------------|
| T038 | Base administrativa em `ai`: endereço, funcionamento, tratamentos oferecidos, formas de pagamento, como é a avaliação e política de preços, sem preço de tratamento. |
| T040 | `calendar` e `scheduling`, com `serviceQuestion: "procedure"` para o evento levar o tratamento, e a agenda de demonstração com compromissos fictícios. |

## Conectores

- CRM: `google-sheets`, com a planilha `Leads` da demo compartilhada com a conta de serviço (T021).
- Agenda: `google-calendar`, com a agenda de demonstração compartilhada com a conta de serviço (T040).
- WhatsApp: número de teste da Meta, com a porta criada à mão com o token da Zenvolyx
  ([passo a passo](../../integrations/whatsapp/client-gateway/README.md)).

## Ativação (T030)

- [ ] textos, regra e base revisados pelo dono
- [ ] porta do WhatsApp criada e `gatewayWorkflowId` preenchido
- [ ] `phoneNumberId`, `spreadsheetId` e `calendarId` preenchidos no lugar de `PREENCHER`
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
