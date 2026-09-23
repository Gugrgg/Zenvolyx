# CRM (contrato do conector)

Contrato que os fluxos usam para gravar leads no CRM do cliente (D008, D011, D017). Os fluxos
chamam o roteador em `router/`, que escolhe o fornecedor pelo `crm.provider` da config; cada
fornecedor fica em `integrations/crm/<fornecedor>/` (T021).

## Entrada

Um item JSON por chamada ao roteador (valores fictícios):

```json
{
  "action": "upsertLead",
  "clientId": "clinica-exemplo",
  "timezone": "America/Sao_Paulo",
  "crm": {
    "provider": "google-sheets",
    "settings": { "spreadsheetId": "planilha-ficticia" }
  },
  "lead": {
    "id": "BR.0000000000000000000",
    "phone": null,
    "name": null,
    "channel": "whatsapp",
    "stage": "qualified",
    "answers": [
      { "question": "Qual atendimento você procura?", "answer": "Avaliação" }
    ],
    "appointment": null,
    "firstContactAt": "2026-09-23T12:00:00Z",
    "lastContactAt": "2026-09-23T12:05:00Z"
  }
}
```

| Campo | Conteúdo |
|-------|----------|
| `timezone` | Fuso da config do cliente, usado para mostrar datas. |
| `crm` | Seção `crm` da config do cliente, sem mudanças. |
| `lead.id` | BSUID do lead (D016). |
| `lead.phone`, `lead.name` | Telefone e nome do perfil do WhatsApp, quando vierem; senão `null`. |
| `lead.stage` | `talking` (em conversa), `qualified`, `not_qualified`, `scheduled` ou `with_team`. |
| `lead.answers` | Perguntas feitas e respostas dadas, com os textos da config. |
| `lead.appointment` | Horário marcado, quando houver: `{ "start", "end", "service" }`, com datas em ISO 8601 (UTC) e `service` podendo ser `null` (D018). |
| `lead.firstContactAt`, `lead.lastContactAt` | Datas em ISO 8601, em UTC. |

## Saída

- Sucesso: `{ "ok": true }`.
- Falha: `{ "ok": false, "error": { "code": "...", "retryable": true } }`. Fornecedor desconhecido
  devolve `code` `unknown_provider` e `retryable` `false`.

## Regras

- `upsertLead` grava o estado completo, então pode repetir sem duplicar: procura o lead pelo `id`;
  se não achar e houver telefone, procura pelo telefone e atualiza o `id` (o BSUID muda quando o
  lead troca de número); se não achar de novo, cria.
- Os fluxos chamam no primeiro contato e a cada mudança de etapa, não a cada mensagem.
- Erro temporário: o conector tenta de novo. Se ainda falhar, devolve falha; o fluxo alerta sem
  dados pessoais e segue a conversa, e a próxima gravação leva o estado completo.
- Grava só os campos acima, nunca o texto da conversa. Os dados no CRM são do cliente, que é o
  controlador na LGPD; a Zenvolyx apenas opera.
- Logs e alertas não levam telefone, nome nem respostas.

## Fornecedores

### google-sheets (padrão)

- Para quem não tem CRM (D008) e para a demo.
- A planilha é do cliente, no Google Drive dele, com a aba `Leads`, compartilhada como editora com
  a conta de serviço da agência (D014). Se o cliente não tiver conta Google, a agência cria a
  planilha e compartilha com ele.
- Config: `"crm": { "provider": "google-sheets", "settings": { "spreadsheetId": "..." } }`. O
  `spreadsheetId` é o trecho da URL da planilha entre `/d/` e `/edit`.
- Colunas da aba `Leads`, nesta ordem: Nome, Telefone, Etapa, Respostas, Agendamento, Canal,
  Primeiro contato, Último contato, ID do lead.
- Etapa em português: Em conversa, Qualificado, Não qualificado, Agendado, Com a equipe. Respostas:
  uma linha por pergunta, no formato "pergunta: resposta". Agendamento como "dd/mm/aaaa hh:mm
  (serviço)". Datas no fuso do cliente (`timezone`).

### Outros CRMs

Entram como conector novo quando um cliente precisar (ex.: RD Station CRM, HubSpot, Pipedrive,
Kommo), com os `settings` documentados aqui. Esses CRMs costumam exigir token por cliente. Como os
nós do n8n não escolhem credencial durante a execução (D014), a forma é decidida e testada na
tarefa do conector, sem token na config nem nos dados da execução, que ficam salvos quando há
erro (D013).

Como testar: fixtures fictícias em `tests/fixtures/crm/` e roteiro de verificação no README de
cada fornecedor (T021).
