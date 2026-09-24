# WhatsApp (contrato do conector)

Contrato que os fluxos usam para enviar mensagens pelo WhatsApp (D011). A implementação da
Cloud API fica em `cloud-api/` (T018). Abordagem completa:
[docs/arquitetura/whatsapp.md](../../docs/arquitetura/whatsapp.md).

## Entrada

Um item JSON por chamada ao sub-workflow:

| Campo | Ações | Conteúdo |
|-------|-------|----------|
| `action` | todas | `sendText`, `sendButtons`, `sendList`, `sendTemplate` ou `markRead`. |
| `clientId` | todas | Cliente que envia, usado em logs e alertas. |
| `gatewayWorkflowId` | todas | ID da porta do cliente (`whatsapp.gatewayWorkflowId` da config, D024). |
| `phoneNumberId` | todas | Número do cliente que envia (`whatsapp.phoneNumberId` da config). |
| `leadId` | envios | BSUID do lead; o conector envia pelo campo `recipient`. |
| `text` | `sendText`, `sendButtons`, `sendList` | Texto da mensagem. |
| `options` | `sendButtons`, `sendList` | Lista de `{ "id", "label" }`, com IDs únicos: até 3 em botões, com `label` de até 20 caracteres; até 10 em lista, com `label` de até 24. |
| `listButton` | `sendList` | Texto do botão que abre a lista, até 20 caracteres. |
| `template` | `sendTemplate` | `{ "name", "language", "parameters": [...] }`, com template aprovado na conta do cliente. |
| `messageId` | `markRead` | `wamid` da mensagem recebida. Marca como lida e mostra "digitando…" até a resposta, por no máximo 25 s. |

Exemplo fictício: [tests/fixtures/whatsapp/connector-send-text.json](../../tests/fixtures/whatsapp/connector-send-text.json).

## Saída

- Sucesso: `{ "ok": true, "messageId": "wamid..." }` (`markRead` não devolve `messageId`).
- Falha: `{ "ok": false, "error": { "code": "...", "retryable": false, "metaCode": 190 } }`, com
  `retryable` indicando se vale tentar de novo mais tarde e `metaCode` com o código de erro da Meta,
  quando houver. Códigos:

| `code` | Quando | `retryable` |
|--------|--------|-------------|
| `invalid_input` | Entrada fora do contrato; `field` diz qual campo. Nada é enviado. | não |
| `no_gateway` | Porta inexistente ou não publicada. | não |
| `auth` | Token recusado pela Meta (HTTP 401 ou código 190). | não |
| `outside_window` | Fora da janela de 24 h; só template (código 131047). | não |
| `undeliverable` | Mensagem não entregável ao lead (código 131026). | não |
| `meta_error` | Outro erro da Meta. | não |
| `invalid_request` | A porta recusou o pedido montado pelo conector. | não |
| `rate_limited` | Limite de taxa (HTTP 429 ou códigos 4, 80007, 130429, 131056). | sim |
| `unavailable` | Erro 5xx, erro temporário da Meta ou falha da porta. | sim |

## Regras

- Em `rate_limited` e `unavailable`, tenta de novo uma vez, 2 s depois, antes de devolver falha.
- Chama a Graph API pela porta do cliente (D023): o conector monta método, caminho e corpo, e a
  porta, que tem a credencial do cliente, faz a chamada ([porta do cliente](client-gateway/README.md)).
  Porta inexistente ou não publicada devolve `code` `no_gateway`; token recusado pela Meta, `auth`.
  Os dois vêm com `retryable` `false`.
- Versão da Graph API fixa (v25.0 em 2026-09), atualizada de propósito.
- Não registra texto de mensagem, BSUID nem telefone; erros levam cliente, ação e código.

Como testar: roteiro no README de [cloud-api/](cloud-api/README.md) (T018).
