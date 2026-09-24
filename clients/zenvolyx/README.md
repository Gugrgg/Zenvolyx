# Zenvolyx (testes internos)

A própria agência como cliente. Foi a demo até a T036; a demo principal agora é a
[clínica fictícia](../odontologia-demo/README.md) (D025). Fica inativa, como segundo cliente, de
outro nicho, para testes internos, e pode voltar a atender os contatos da própria Zenvolyx.
Formato da config: [clients/README.md](../README.md). Este README guarda só informação técnica.

Perguntas, regra de qualificação, base da IA e mensagens são uma proposta: o dono revisa os textos
e a regra antes de ativar. A base não traz preços de propósito; perguntas sobre preço vão para a
equipe.

## Conectores

- CRM: `google-sheets`, com a planilha `Leads` da Zenvolyx compartilhada com a conta de serviço.
- Agenda: `google-calendar`, com a agenda de apresentações compartilhada com a conta de serviço
  ("Fazer alterações nos eventos").
- WhatsApp: na etapa 1, número de teste da Meta; na etapa 2, número próprio da Zenvolyx direto na
  Cloud API.

## Ativação

- [ ] textos, regra e base revisados pelo dono
- [ ] porta do WhatsApp criada à mão com o token da Zenvolyx ([passo a passo](../../integrations/whatsapp/client-gateway/README.md))
- [ ] `phoneNumberId`, `gatewayWorkflowId`, `spreadsheetId` e `calendarId` preenchidos no lugar de `PREENCHER`
- [ ] planilha e agenda compartilhadas com a conta de serviço
- [ ] `npm test` passando e teste com um lead fictício
- [ ] `active: true` e commit

## Particularidades

- Sem coexistência, "chamar a equipe" é o aviso por e-mail à agência; o dono vê o contato na
  planilha e responde por outro canal.
- O link da videochamada é enviado à mão pelo dono, porque o evento não tem convidados (D018).
