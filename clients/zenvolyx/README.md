# Zenvolyx (cliente da demo)

A própria agência como cliente, para a demo ([docs/arquitetura/demo.md](../../docs/arquitetura/demo.md)).
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
- [ ] `phoneNumberId`, `spreadsheetId` e `calendarId` preenchidos no lugar de `PREENCHER`
- [ ] planilha e agenda compartilhadas com a conta de serviço
- [ ] `npm test` passando e teste de ponta a ponta com o celular do dono (T030)
- [ ] `active: true` e commit

## Particularidades

- Sem coexistência, "chamar a equipe" é o aviso por e-mail à agência; o dono vê o contato na
  planilha e responde por outro canal.
- O link da videochamada é enviado à mão pelo dono, porque o evento não tem convidados (D018).
