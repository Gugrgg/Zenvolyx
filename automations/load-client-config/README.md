# Load client config

Sub-workflow que acha o cliente ativo pelo número de WhatsApp que recebeu a mensagem e
devolve a config dele (D014). Quem chama: a entrada do WhatsApp (T019) e outros fluxos.
ID fixo `loadClientConfig` (D022).

## Contrato

Entrada: um item `{ "phoneNumberId": "..." }`. Exemplo fictício em
[tests/fixtures/load-client-config/input.json](../../tests/fixtures/load-client-config/input.json).

Saída: sempre um item.

| Campo | Conteúdo |
|-------|----------|
| `found` | `true` quando há exatamente um cliente ativo com esse `phoneNumberId`. |
| `config` | Config completa do cliente, só quando `found` é `true`. |
| `reason` | Quando `found` é `false`: `not_found`, `duplicate` (mais de um cliente ativo com o número; IDs em `clientIds`) ou `invalid_input` (número ausente, vazio ou fora do tipo texto). |
| `invalidConfigs` | Pastas com `config.json` ilegível ou com `id` diferente da pasta. Vem sempre, mesmo com cliente encontrado. |

Pastas com `_` (modelos) e clientes com `active: false` são ignorados. O alerta fica com
quem chama: `found: false` ou `invalidConfigs` com itens geram aviso sem dados pessoais (T027).

## Como funciona

1. **When Executed by Another Workflow**: aceita os dados de quem chama.
2. **Read client configs**: lê `/files/clients/*/config.json`, a pasta `clients/` montada só
   para leitura (T012). Sem arquivos, segue com um item vazio.
3. **Select client**: nó de código que faz a escolha acima.

Para chamar: nó **Execute Workflow**, fonte "Database", workflow pelo ID `loadClientConfig`,
modo "Run once for each item".

## Importar e publicar

No n8n 2.x, um sub-workflow só pode ser chamado se estiver **publicado**. Na raiz do
repositório, com o n8n local ligado, estes comandos copiam o JSON para o container,
importam (a importação despublica), publicam e reiniciam o n8n para a publicação valer no
servidor. Detalhes em [comandos da CLI](../../infra/n8n/README.md#7-comandos-da-cli-do-n8n).

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp automations/load-client-config/workflow.json n8n:/tmp/load-client-config.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/load-client-config.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=loadClientConfig
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

## Como testar

- Automático: `npm test -- tests/load-client-config.test.ts` roda o código do nó
  **Select client**, tirado deste JSON, com clientes fictícios de
  `tests/fixtures/load-client-config/`. `npm run check:workflows` confere o export.
- No n8n: num workflow temporário, **Manual Trigger** → **Code** devolvendo
  `{ "phoneNumberId": "..." }` → **Execute Workflow** (ID `loadClientConfig`, "Run once for
  each item"). Com só o modelo e a Zenvolyx inativa em `clients/`, o esperado é
  `not_found`; para ver `found: true`, é preciso um cliente ativo com esse número. Na T016,
  sete casos foram conferidos assim, com clientes fictícios temporários: ativo, inativo,
  duplicado, modelo, número desconhecido, vazio e ausente.
- Depois de editar no n8n: exportar de novo para `workflow.json`, limpo conforme a D022, e
  rodar `npm test`, `npm run lint` e `npm run check:workflows`.
