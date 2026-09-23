# WhatsApp (contrato do conector)

Contrato que os fluxos usam para enviar mensagens pelo WhatsApp (D011). A implementação da
Cloud API fica em `cloud-api/` (T018). Abordagem completa:
[docs/arquitetura/whatsapp.md](../../docs/arquitetura/whatsapp.md).

## Entrada

Um item JSON por chamada ao sub-workflow:

| Campo | Ações | Conteúdo |
|-------|-------|----------|
| `action` | todas | `sendText`, `sendButtons`, `sendList`, `sendTemplate` ou `markRead`. |
| `phoneNumberId` | todas | Número do cliente que envia (`whatsapp.phoneNumberId` da config). |
| `leadId` | envios | BSUID do lead; o conector envia pelo campo `recipient`. |
| `text` | `sendText`, `sendButtons`, `sendList` | Texto da mensagem. |
| `options` | `sendButtons`, `sendList` | Lista de `{ "id", "label" }`: até 3 em botões e até 10 em lista; `label` com até 20 caracteres. |
| `listButton` | `sendList` | Texto do botão que abre a lista, até 20 caracteres. |
| `template` | `sendTemplate` | `{ "name", "language", "parameters": [...] }`, com template aprovado na conta do cliente. |
| `messageId` | `markRead` | `wamid` da mensagem recebida. Se a API permitir, mostra também "digitando…". |

## Saída

- Sucesso: `{ "ok": true, "messageId": "wamid..." }` (`markRead` não devolve `messageId`).
- Falha: `{ "ok": false, "error": { "code": "...", "retryable": true } }`, com `retryable`
  indicando se vale tentar de novo mais tarde.

## Regras

- Tenta de novo sozinho em erro temporário (limite de taxa, erro 5xx) antes de devolver falha.
- Usa a credencial única da agência (D014, D015). Se o nó nativo do n8n não aceitar `recipient`,
  usa o nó HTTP Request com essa credencial.
- Versão da Graph API fixa na implementação, atualizada de propósito.
- Não registra texto de mensagem, BSUID nem telefone; erros levam cliente, ação e código.

Como testar: payloads fictícios em `tests/fixtures/whatsapp/` e roteiro de verificação no README de
`cloud-api/` (T018).
