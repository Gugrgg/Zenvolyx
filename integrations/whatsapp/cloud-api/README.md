# WhatsApp Cloud API connector

Sub-workflow que envia mensagens e marca mensagens como lidas pela Cloud API, seguindo o
[contrato do conector](../README.md). ID fixo `whatsappCloudApi` (D022, D024). Chamado pelos
fluxos da conversa (T028, T029) com o nó **Execute Workflow**, fonte "Database", modo "Run once
for each item".

## Como funciona

1. **Build request**: confere a entrada conforme o contrato e monta o corpo da Graph API. Envio
   pelo BSUID no campo `recipient`; "marcar como lida" vai com o indicador de digitação. Entrada
   inválida para aqui, com `invalid_input` e o nome do campo.
2. **Call gateway**: chama a porta do cliente (`gatewayWorkflowId`,
   [porta do cliente](../client-gateway/README.md)) com `POST /<phoneNumberId>/messages`. Falha ao
   chamar a porta não derruba o conector: vira um código de erro.
3. **Classify**: traduz a resposta nos códigos do contrato. Em `rate_limited` ou `unavailable`,
   espera 2 s (**Wait**) e tenta de novo uma única vez (**Call gateway (retry)**).
4. **Result**: devolve só a saída do contrato.

O conector não registra texto, BSUID nem telefone; a Meta responde para a porta, e os erros
levam só código, `metaCode` e o campo inválido.

## Importar e publicar

Na raiz do repositório, com o n8n local ligado. Estes comandos copiam o JSON para o container,
importam (a importação despublica), publicam e reiniciam o n8n para a publicação valer no
servidor ([comandos da CLI](../../../infra/n8n/README.md#7-comandos-da-cli-do-n8n)):

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp integrations/whatsapp/cloud-api/workflow.json n8n:/tmp/whatsapp-cloud-api.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/whatsapp-cloud-api.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=whatsappCloudApi
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

## Como testar

- Automático: `npm test -- tests/whatsapp-cloud-api.test.ts` roda o código dos nós deste JSON:
  corpo de cada ação, validação da entrada, tradução dos erros da Meta, nova tentativa única e o
  exemplo de [tests/fixtures/whatsapp/](../../../tests/fixtures/whatsapp/connector-send-text.json).
- No n8n: num workflow temporário, **Manual Trigger** → **Code** com o exemplo acima → **Execute
  Workflow** (ID `whatsappCloudApi`). Na T018, seis casos foram conferidos assim, com uma porta de
  teste de token fictício: texto, lista e "marcar como lida" chegaram à Meta e voltaram como
  `auth` (código 190); quatro botões deram `invalid_input`; porta inexistente, `no_gateway`; e uma
  porta que falha de propósito deu `unavailable` depois da nova tentativa.
- Envio de verdade: pendente de um token válido e do número de teste da Meta (teste de ponta a
  ponta, T030).
