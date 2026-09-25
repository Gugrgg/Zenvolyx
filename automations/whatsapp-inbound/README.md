# WhatsApp inbound

Entrada única do WhatsApp (D016, D027, D028). Recebe os eventos de todos os clientes do app da
Meta, confere a assinatura, descarta repetidos, junta as mensagens seguidas de cada lead, respeita
a pausa do atendimento humano e entrega um evento por rajada, com a config do cliente. ID fixo
`waInboundWebhook`. Abordagem: [docs/arquitetura/whatsapp.md](../../docs/arquitetura/whatsapp.md#entrada-d016).

## Como funciona

- `GET /webhook/whatsapp` (**Meta verification request**): responde ao desafio da Meta. O verify
  token não fica guardado em lugar nenhum: é o HMAC-SHA256 da frase fixa
  `zenvolyx-whatsapp-webhook` com o App Secret (**Derive verify token (HMAC)**). Com
  `hub.mode=subscribe` e o token certo, devolve 200 com o `hub.challenge`; senão, 403.
- `POST /webhook/whatsapp` (**WhatsApp events**): responde 200 na hora e depois:
  1. **Compute signature**: HMAC-SHA256 do corpo bruto com o App Secret.
  2. **Parse events**: compara com o cabeçalho `X-Hub-Signature-256` e lê dois campos. Em
     `messages`, texto vira `text`; resposta de botão ou lista, `reply`; os demais tipos (áudio,
     imagem, localização etc.), `unsupported`, que a conversa manda para a equipe. Em
     `smb_message_echoes`, a mensagem que a equipe mandou pelo app vira um eco. Status `failed`
     vai para o log. São descartados: `history`, `smb_app_state_sync`, `account_update`, os
     demais status, reações e mensagens de sistema.
  3. **Ensure message table**, **Ensure pause table** e **Ensure buffer table** criam as tabelas
     que ainda não existem; **Is new message** descarta IDs já vistos; **Record message** guarda
     o ID.
  4. **Load client config** acha o cliente ativo pelo número ([load-client-config](../load-client-config/README.md));
     **Build event** monta o evento da mensagem ou a chave de pausa do eco.
  5. Eco da equipe: **Pause for team** pausa o lead por 24 h.
  6. Mensagem: **Buffer message** guarda a mensagem na tabela de rajadas e **Wait for silence**
     espera 8 s. Só a execução da mensagem mais recente do lead segue (**Latest per lead**,
     **Read burst**, **Group burst**): ela junta todas as mensagens guardadas num evento só e
     apaga essas linhas (**Delete burst rows**). As execuções anteriores param aí.
  7. **Read pause** e **Is not paused**: rajada de lead pausado é descartada, sem resposta e sem
     marcar como lida. **Burst event** entrega o evento.
- **Every day**, às 3h, apaga IDs com mais de 7 dias (o prazo em que a Meta ainda reenvia um
  evento), pausas vencidas e linhas de rajada com mais de 1 hora, que só sobram se uma execução
  falhar no meio.

A ordem de execução é a "v1": entre ramos que saem do mesmo nó, o de cima roda inteiro antes. É
isso que cria as tabelas antes de usá-las, grava o ID antes de carregar o cliente, lê a rajada
antes da pausa e apaga as linhas antes de entregar o evento. Ao editar no n8n, não mude a altura
desses nós.

## Saída

Um item por rajada de lead ativo e não pausado, `{ "event": {...}, "config": {...} }`, na saída
de **Burst event**. O `event` segue o formato de [docs/arquitetura/whatsapp.md](../../docs/arquitetura/whatsapp.md#entrada-d016)
(`clientId`, `channel`, `leadId`, `phone`, `name`, `messageIds`, `type`, `text`, `replyId`,
`receivedAt`):

- `messageIds`: todas as mensagens da rajada, na ordem em que chegaram;
- `text`: os textos da rajada (inclusive o rótulo de botão ou lista), um por linha;
- `type`: `unsupported` se a rajada tiver mídia; senão `reply` se tiver resposta de botão ou
  lista, com o `replyId` da última; senão `text`;
- `receivedAt`: a hora da última mensagem.

A conversa (T028) parte daqui.

## Tabelas

Data tables do n8n, criadas pelo próprio fluxo e referenciadas pelo nome (D027).

| Tabela | Colunas | Limpeza |
|--------|---------|---------|
| `whatsapp_processed_messages` | `messageId` | 7 dias |
| `whatsapp_message_buffer` | `clientId`, `leadId`, `messageId`, `type`, `text`, `replyId`, `receivedAt` | ao responder a rajada; sobras com mais de 1 hora |
| `whatsapp_lead_pauses` | `clientId`, `leadKey`, `pausedUntil`, `reason` | depois de vencida |

A tabela de rajadas é a única que guarda texto do lead, por segundos (D028).

## Pausa

Uma linha por cliente e lead em `whatsapp_lead_pauses`. Enquanto `pausedUntil` não passar, a
entrada não entrega as rajadas daquele lead (D028).

- `leadKey` é o BSUID do lead. Eco sem BSUID usa `tel:` mais o telefone; a checagem confere as
  duas chaves.
- `reason`: `team` (eco da equipe, gravado aqui), `handoff`, `urgent` e `stop` (gravados pela
  conversa, T028).
- Para pausar, a conversa faz um upsert com os filtros `clientId` e `leadKey` iguais e
  `pausedUntil` daqui a 24 h. Cada novo motivo reinicia as 24 h.

## Logs

Sem dados pessoais, no log do container (`CODE_ENABLE_STDOUT`, [infra/n8n](../../infra/n8n/README.md#5-retenção-e-acesso-a-arquivos)).
O aviso por e-mail à agência fica para a T027.

| `event` | Quando |
|---------|--------|
| `whatsapp_verification_rejected` | GET sem o verify token certo. |
| `whatsapp_invalid_signature` | POST sem assinatura ou com assinatura de outro segredo. |
| `whatsapp_unexpected_payload` | Corpo assinado que não é notificação do WhatsApp. |
| `whatsapp_invalid_payload`, `whatsapp_invalid_message`, `whatsapp_invalid_echo` | Notificação sem o número da empresa, mensagem sem ID ou BSUID, ou eco sem ID nem lead. |
| `whatsapp_failed_status` | Mensagem enviada que falhou; traz `phoneNumberId` e `errorCodes`. |
| `whatsapp_webhook_error` | Erro geral da Meta na notificação, com os códigos. |
| `whatsapp_unknown_client` | Número sem cliente ativo; traz `phoneNumberId` e `reason` do loader. |
| `client_configs_invalid` | Pastas de `clients/` com config ilegível. |
| `whatsapp_team_reply` | A equipe respondeu pelo app; o lead foi pausado. Traz `clientId`. |
| `whatsapp_paused_lead` | Rajada descartada porque o lead está pausado. Traz `clientId`. |

## Limites conhecidos

- A documentação da Meta mostra o eco com o telefone do lead (`to`) e não diz se ele traz o BSUID.
  O fluxo usa `to_user_id` quando vier e, sem ele, pausa pelo telefone; lead com nome de usuário
  e sem telefone não é pausado pelo eco.
- A pausa por eco supõe que a Meta só manda eco das mensagens enviadas pelo app, e não das
  enviadas pela API. Se o eco trouxer também as da API, toda resposta automática pausaria o
  lead: conferir no primeiro cliente em coexistência (B012).
- O número de teste da Meta não usa o app e não gera eco: a pausa por eco só foi testada com
  eventos simulados.

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

   O `publish:workflow` precisa responder "Publishing workflow with ID: waInboundWebhook". Sem
   essa linha, publicar de novo antes de reiniciar.
3. O JSON não leva credenciais (D022): no editor, selecionar `WhatsApp App Secret` nos nós
   **Derive verify token (HMAC)** e **Compute signature**, salvar e publicar de novo.
4. As tabelas são criadas sozinhas na primeira mensagem. O loader precisa estar publicado.

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
  assinatura, tipos de mensagem, eco da equipe, status `failed`, descartes, lote, agrupamento da
  rajada, pausa, logs sem dados pessoais e o formato do evento, e confere ligações, ordem dos
  ramos e as tabelas.
- No n8n local, com uma credencial de teste e um cliente fictício temporário, requisições
  assinadas simularam a Meta.
  - Na T019: desafio aceito e recusado, texto com acentos escapados e sem escapar, duplicata,
    assinatura errada e ausente, botão, lista, usuário sem telefone, áudio, status `failed`,
    histórico, número desconhecido, lote, corpo que não é da Meta, gatilho do verify token e
    limpeza.
  - Na T020: mensagem única, rajada de duas mensagens, rajada com botão e com áudio, lote do
    mesmo lead, eco com BSUID e só com telefone, eco durante a espera, segundo eco na mesma
    linha, pausa vencida e limpeza diária das três tabelas.
- Depois de editar no n8n: exportar de novo para `workflow.json`, limpo conforme a D022, e rodar
  `npm test`, `npm run lint` e `npm run check:workflows`.
