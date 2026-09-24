# WhatsApp client gateway (porta do cliente)

Modelo da porta do cliente (D023, D024): o único lugar que usa a credencial de WhatsApp de um
cliente. Cada cliente tem uma cópia publicada deste modelo, ligada à credencial dele, e o
ID dessa cópia fica em `whatsapp.gatewayWorkflowId` na config do cliente. O conector de
WhatsApp (T018) chama a Graph API sempre por ela.

## Contrato

Entrada: um item `{ "method", "path", "query", "body" }`.

- `method`: `GET`, `POST` ou `DELETE`.
- `path`: caminho da Graph API, como `/<PHONE_NUMBER_ID>/messages`; só letras, números, `_`,
  `-` e `/`, até 200 caracteres. A base é fixa: `https://graph.facebook.com/v25.0`.
- `query` (opcional): parâmetros de consulta, todos em texto.
- `body` (opcional): corpo JSON, sempre um objeto.

Saída: `{ "status", "body" }` com a resposta da Meta, inclusive em erro HTTP (ex.: `401` com
`body.error.code` `190` para token recusado). Pedido fora das regras não sai para a Meta e
volta como `{ "status": 0, "body": null, "rejected": "..." }`, com `invalid_method`,
`invalid_path`, `invalid_query` ou `invalid_body`.

## Criar a porta de um cliente à mão

Usado na demo; para clientes reais, a criação é automática no cadastro (T035). No editor do n8n
local ([como entrar](../../../infra/n8n/README.md)):

1. **Credentials** → nova credencial **Header Auth**: *Name* `Authorization`, *Value*
   `Bearer <token do cliente>`; nome `WhatsApp - <id do cliente>`. Na demo, o token é o de
   usuário do sistema da própria Zenvolyx, gerado nas configurações do portfólio na Meta com as
   permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
2. **Workflows** → abrir **WhatsApp client gateway (template)** → menu **⋯** → **Duplicate**,
   com o nome `WhatsApp gateway - <id do cliente>`.
3. Na cópia, abrir o nó **Call Graph API**, escolher a credencial do passo 1, salvar e
   **publicar**.
4. Copiar o ID da cópia, que aparece no endereço (`.../workflow/<ID>`, 16 letras e números), para
   `whatsapp.gatewayWorkflowId` em `clients/<id>/config.json`, e rodar `npm run check:clients`.

O token só existe na credencial: não vai para a config, para o repositório nem para logs.

Se a instância ainda não tiver o modelo, importá-lo pelos
[comandos da CLI](../../../infra/n8n/README.md#7-comandos-da-cli-do-n8n) (`workflow.json` desta
pasta; o modelo não precisa ser publicado).

## Como testar

- Automático: `npm test -- tests/whatsapp-client-gateway.test.ts` roda o código dos nós deste
  JSON: pedidos aceitos, recusas (host embutido, subida de pasta, método e tipos inválidos) e
  formato da resposta. `npm run check:workflows` confere que o modelo não leva credencial.
- No n8n: na T033, uma porta de teste com credencial de token fictício chamou `GET /me` e recebeu
  `status` 401 com erro `190` da Meta, o que confirma o caminho até a Graph API; os caminhos
  inválidos foram recusados sem sair do n8n.
