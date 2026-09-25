# CRM router

Sub-workflow que os fluxos chamam para gravar o lead no CRM do cliente, seguindo o
[contrato do CRM](../README.md) (D017). ID fixo `crmUpsertRouter1` (D022, D024). Chamado pela
conversa (T028, T029) com o nó **Execute Workflow**, fonte "Database", modo "Run once for each
item".

## Como funciona

1. **Validate lead**: confere a entrada conforme o contrato e escolhe o conector pelo
   `crm.provider`. Entrada inválida para aqui, com `invalid_input` e o nome do campo; fornecedor
   sem conector, com `unknown_provider`.
2. **Call provider**: chama o conector do fornecedor. Hoje só `google-sheets`
   ([crmGoogleSheets1](../google-sheets/README.md)). Falha ao chamar o conector não derruba o
   roteador: conector ausente ou não publicado vira `no_provider`; outra falha, `unavailable`.
3. **Classify**: repassa o resultado do conector. Em erro temporário (`retryable`), espera 2 s
   (**Wait**) e tenta de novo uma única vez (**Call provider (retry)**).
4. **Result**: devolve só a saída do contrato.

Para um CRM novo: criar o conector em `integrations/crm/<fornecedor>/`, com a mesma entrada e a
mesma saída, e acrescentar o fornecedor em `PROVIDERS`, no nó **Validate lead**, com o ID do
workflow e a validação dos `settings`.

## Logs

Sem dados pessoais, no log do container (`CODE_ENABLE_STDOUT`), todos com `clientId`:
`crm_invalid_input` (com `field`), `crm_unknown_provider` e `crm_upsert_failed` (com `code`). O
aviso à agência fica para a T027.

## Importar e publicar

O roteador e cada conector precisam estar publicados. Na raiz do repositório, com o n8n ligado,
estes comandos copiam o JSON para o container, importam (a importação despublica), publicam e
reiniciam o n8n ([comandos da CLI](../../../infra/n8n/README.md#7-comandos-da-cli-do-n8n)):

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp integrations/crm/router/workflow.json n8n:/tmp/crm-router.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/crm-router.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=crmUpsertRouter1
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

O `publish:workflow` precisa responder "Publishing workflow with ID: crmUpsertRouter1".

## Como testar

- Automático: `npm test -- tests/crm-router.test.ts` roda o código dos nós deste JSON: validação
  de cada campo do contrato, as sete etapas, fornecedor desconhecido, repasse do resultado,
  nova tentativa única e falhas ao chamar o conector, com as fixtures de
  [tests/fixtures/crm/](../../../tests/fixtures/crm/).
- No n8n: na T021, um workflow temporário chamou o roteador com 14 casos, com o conector apontando
  para uma API do Google Sheets simulada. Os resultados estão no [README do conector](../google-sheets/README.md#como-testar).
