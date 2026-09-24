# WhatsApp inbound

Entrada única do WhatsApp (D016, D027). Recebe os eventos de todos os clientes do app da Meta,
confere a assinatura, descarta repetidos e entrega um evento por mensagem nova, com a config do
cliente. ID fixo `waInboundWebhook`. Abordagem: [docs/arquitetura/whatsapp.md](../../docs/arquitetura/whatsapp.md#entrada-d016).

## Como funciona

- `GET /webhook/whatsapp` (**Meta verification request**): responde ao desafio da Meta. O verify
  token não fica guardado em lugar nenhum: é o HMAC-SHA256 da frase fixa
  `zenvolyx-whatsapp-webhook` com o App Secret (**Derive verify token (HMAC)**). Com
  `hub.mode=subscribe` e o token certo, devolve 200 com o `hub.challenge`; senão, 403.
- `POST /webhook/whatsapp` (**WhatsApp events**): responde 200 na hora e depois:
  1. **Compute signature**: HMAC-SHA256 do corpo bruto com o App Secret.
  2. **Parse events**: compara com o cabeçalho `X-Hub-Signature-256` e lê o campo `messages`.
     Texto vira `text`; resposta de botão ou lista, `reply`; os demais tipos (áudio, imagem,
     localização etc.), `unsupported`, que a conversa manda para a equipe. Status `failed` vai
     para o log. São descartados: `history`, `smb_app_state_sync`, `account_update`, os demais
     status, reações e mensagens de sistema. O eco da equipe (`smb_message_echoes`) fica para a
     T020.
  3. **Ensure message table** cria a Data table `whatsapp_processed_messages` se ela ainda não
     existe; **Is new message** descarta IDs já vistos; **Record message** guarda o ID.
  4. **Load client config** acha o cliente ativo pelo número ([load-client-config](../load-client-config/README.md));
     **Build event** monta o evento.
- **Every day**, às 3h: apaga os IDs com mais de 7 dias, o prazo em que a Meta ainda reenvia um
  evento.

A ordem de execução é a "v1": entre ramos que saem do mesmo nó, o de cima roda inteiro antes. É
isso que cria a tabela antes da deduplicação e grava o ID antes de carregar o cliente. Ao editar
no n8n, não mude a altura desses nós.

## Saída

Um item por mensagem nova de cliente ativo, `{ "event": {...}, "config": {...} }`. O `event`
segue o formato de [docs/arquitetura/whatsapp.md](../../docs/arquitetura/whatsapp.md#entrada-d016)
(`clientId`, `channel`, `leadId`, `phone`, `name`, `messageIds`, `type`, `text`, `replyId`,
`receivedAt`), com uma mensagem por evento até a T020 agrupar as rajadas. A conversa (T028) parte
daqui. Mensagem de número sem cliente ativo para no log.

## Logs

Sem dados pessoais, no log do container (`CODE_ENABLE_STDOUT`, [infra/n8n](../../infra/n8n/README.md#5-retenção-e-acesso-a-arquivos)).
O aviso por e-mail à agência fica para a T027.

| `event` | Quando |
|---------|--------|
| `whatsapp_verification_rejected` | GET sem o verify token certo. |
| `whatsapp_invalid_signature` | POST sem assinatura ou com assinatura de outro segredo. |
| `whatsapp_unexpected_payload` | Corpo assinado que não é notificação do WhatsApp. |
| `whatsapp_invalid_payload`, `whatsapp_invalid_message` | Notificação sem o número da empresa, ou mensagem sem ID ou BSUID. |
| `whatsapp_failed_status` | Mensagem enviada que falhou; traz `phoneNumberId` e `errorCodes`. |
| `whatsapp_webhook_error` | Erro geral da Meta na notificação, com os códigos. |
| `whatsapp_unknown_client` | Número sem cliente ativo; traz `phoneNumberId` e `reason` do loader. |
| `client_configs_invalid` | Pastas de `clients/` com config ilegível. |

## Instalar numa instância

1. No n8n, criar a credencial **Crypto** com o nome `WhatsApp App Secret` e o App Secret do app
   da Meta no campo **Hmac Secret**. No n8n local ela já existe, com o valor `PREENCHER`.
2. Importar e publicar. Na raiz do repositório, com o n8n ligado, estes comandos copiam o JSON
   para o container, importam (a importação despublica), publicam e reiniciam o n8n
   ([comandos da CLI](../../infra/n8n/README.md#7-comandos-da-cli-do-n8n)):

   ```powershell
   docker compose --env-file .env -f infra/n8n/compose.yaml cp automations/whatsapp-inbound/workflow.json n8n:/tmp/whatsapp-inbound.json
   docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/whatsapp-inbound.json
   docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=waInboundWebhook
   docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
   ```

3. O JSON não leva credenciais (D022): no editor, selecionar `WhatsApp App Secret` nos nós
   **Derive verify token (HMAC)** e **Compute signature**, salvar e publicar de novo.
4. A Data table é criada sozinha na primeira mensagem. O loader precisa estar publicado.

## Ligar o app de teste da Meta

Com o n8n local ligado. Painel da Meta: [developers.facebook.com](https://developers.facebook.com/apps/).

1. **App.** Em My Apps, criar um app com o caso de uso de WhatsApp ("conectar com clientes pelo
   WhatsApp") e ligar a um portfólio empresarial. O app ganha um número de teste gratuito.
2. **Seu celular.** Em WhatsApp > API Setup, cadastrar o seu número como destinatário e confirmar
   o código recebido. O número de teste só conversa com até 5 números cadastrados.
3. **App Secret.** Em App settings > Basic, clicar em Show no App Secret e colar o valor no
   n8n, no campo **Hmac Secret** da credencial `WhatsApp App Secret`. Nunca colar em chat,
   e-mail ou no repositório.
4. **Túnel.** Ligar o túnel e trocar a `WEBHOOK_URL` ([infra/n8n, seção 4](../../infra/n8n/README.md#4-ligar-o-túnel-só-durante-testes-externos)).
   A URL do webhook fica `https://<endereço>.trycloudflare.com/webhook/whatsapp`.
5. **Verify token.** No editor, abrir o workflow **WhatsApp inbound** e executar o gatilho
   **Show verify token for Meta** (botão de executar no próprio nó). Copiar o campo `verifyToken`
   da saída do nó **Check verification**. Execuções manuais não ficam salvas.
6. **Webhook na Meta.** Em WhatsApp > Configuration (ou Use cases > Customize > Configuration),
   no bloco Webhook, clicar em Edit: Callback URL do passo 4 e Verify token do passo 5, depois
   Verify and save. Em seguida, assinar o campo `messages`.
7. **Teste.** Mandar "Oi" do seu celular para o número de teste e ver o log
   ([comando](../../infra/n8n/README.md#5-retenção-e-acesso-a-arquivos)). Até a clínica da demo
   ser ativada (T030), o esperado é `whatsapp_unknown_client` com `reason` `not_found`: a
   mensagem chegou, a assinatura conferiu e o número foi lido. `whatsapp_invalid_signature`
   indica App Secret errado na credencial.
8. **Depois.** Desligar o túnel e voltar a `WEBHOOK_URL` para `http://localhost:5678/`. Cada túnel
   novo tem outra URL: repetir os passos 4 e 6. O verify token só muda se o App Secret mudar.

## Como testar

- Automático: `npm test -- tests/whatsapp-inbound.test.ts` roda o código dos nós deste JSON com
  as fixtures de [tests/fixtures/whatsapp/](../../tests/fixtures/whatsapp/). Cobre verificação,
  assinatura, tipos de mensagem, status `failed`, descartes, lote, logs sem dados pessoais e o
  formato do evento, e confere ligações, ordem dos ramos e a Data table.
- No n8n local: na T019, uma credencial de teste e um cliente fictício temporário permitiram
  simular a Meta com requisições assinadas. Foram conferidos: desafio aceito e recusado, texto
  com acentos escapados e sem escapar, duplicata, assinatura errada e ausente, botão, lista,
  usuário sem telefone, áudio, status `failed`, histórico, número desconhecido, lote com duas
  mensagens, corpo que não é da Meta, gatilho do verify token e limpeza da tabela.
- Depois de editar no n8n: exportar de novo para `workflow.json`, limpo conforme a D022, e rodar
  `npm test`, `npm run lint` e `npm run check:workflows`.
