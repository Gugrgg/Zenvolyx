# Agenda (contrato do conector)

Contrato que os fluxos usam para oferecer horários e marcar atendimentos (D011, D018). Os fluxos
chamam o roteador em `router/`, que calcula os horários pela config do cliente e usa o fornecedor
de `calendar.provider`; cada fornecedor fica em `integrations/calendar/<fornecedor>/` (T022).

## listSlots

Devolve os próximos horários livres. Entrada (valores fictícios; `calendar`, `scheduling` e
`timezone` vêm da config do cliente, sem mudanças):

```json
{
  "action": "listSlots",
  "clientId": "clinica-exemplo",
  "timezone": "America/Sao_Paulo",
  "calendar": {
    "provider": "google-calendar",
    "settings": { "calendarId": "agenda-ficticia@group.calendar.google.com" }
  },
  "scheduling": {
    "durationMinutes": 60,
    "minNoticeHours": 2,
    "daysAhead": 14,
    "hours": { "mon": ["09:00-12:00", "14:00-18:00"] }
  },
  "limit": 10
}
```

Saída: `{ "ok": true, "slots": [{ "start": "2026-09-28T12:00:00Z", "end": "2026-09-28T13:00:00Z", "label": "Seg 28/09 09:00" }] }`.

- Horários = expediente (`scheduling.hours`, no fuso `timezone`) dividido em blocos de
  `durationMinutes`, de agora + `minNoticeHours` até `daysAhead` dias, menos o que já está ocupado
  na agenda. Mais cedo primeiro, no máximo `limit` (até 10, o limite da lista do WhatsApp).
- `start` e `end` em ISO 8601, em UTC. `label` no fuso do cliente, com até 24 caracteres.

## book

Marca um horário devolvido por `listSlots`:

```json
{
  "action": "book",
  "clientId": "clinica-exemplo",
  "timezone": "America/Sao_Paulo",
  "calendar": {
    "provider": "google-calendar",
    "settings": { "calendarId": "agenda-ficticia@group.calendar.google.com" }
  },
  "slot": { "start": "2026-09-28T12:00:00Z", "end": "2026-09-28T13:00:00Z" },
  "lead": { "id": "BR.0000000000000000000", "name": null, "phone": null },
  "service": "Avaliação"
}
```

Saída: `{ "ok": true, "eventId": "..." }`.

- Confere a ocupação do horário logo antes de criar o evento. Se alguém ocupou nesse meio-tempo,
  devolve falha com `code` `slot_taken`, e o fluxo oferece novos horários.
- Evento: título "<serviço> – <nome>" (sem serviço: "Atendimento"; sem nome: "Lead do WhatsApp"),
  descrição com o telefone, se houver, e "Agendado pelo WhatsApp (Zenvolyx)". O `lead.id` vai só
  nas propriedades privadas do evento, para lembretes futuros. Sem convidados.

## Saída com falha

`{ "ok": false, "error": { "code": "...", "retryable": true } }`. Códigos próprios: `slot_taken` e
`unknown_provider` (ambos com `retryable` `false`). Erro temporário do fornecedor: o conector tenta
de novo antes de devolver falha.

## Regras

- A IA nunca inventa horário: a conversa só oferece o que `listSlots` devolveu.
- Feriados, folgas e bloqueios: o cliente marca na própria agenda, e a automação respeita qualquer
  compromisso existente.
- O evento leva só nome, telefone e serviço: nada de respostas de qualificação nem dados de saúde.
- Logs e alertas não levam nome nem telefone.

## Fornecedores

### google-calendar (padrão)

- A agenda é do cliente e fica compartilhada com a conta de serviço da agência, a mesma do Sheets
  (D014, D017), com a permissão "Fazer alterações nos eventos".
- Config: `"calendar": { "provider": "google-calendar", "settings": { "calendarId": "..." } }`. O
  ID fica nas configurações da agenda, em "Integrar agenda".
- O nó Google Calendar do n8n não aceita conta de serviço: o conector usa o nó HTTP Request com a
  credencial de conta de serviço (Calendar API: consulta de ocupação e criação de evento).
- Conta de serviço não pode convidar pessoas sem delegação de domínio; por isso o evento não tem
  convidados, e a confirmação vai pelo WhatsApp.

### Outros

Outras agendas (ex.: Outlook, sistemas de clínica) entram como conector novo quando um cliente
precisar, informando ocupação e criando eventos do mesmo jeito.

## Depois da demo

- Lembrete antes do horário, por template de utilidade enviado ao BSUID guardado no evento (T023).
- Remarcar e cancelar pelo WhatsApp.

Como testar: fixtures fictícias em `tests/fixtures/calendar/` e roteiro de verificação no README de
cada fornecedor (T022).
