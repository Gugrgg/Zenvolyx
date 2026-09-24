# WhatsApp

Como a Zenvolyx usa a API oficial do WhatsApp (Cloud API, D007). Decisões: D016 e D023 no
[DECISIONS.md](../../DECISIONS.md). Contrato do conector: [integrations/whatsapp](../../integrations/whatsapp/README.md).
Regras da Meta conferidas em 2026-09 na documentação oficial (links no fim).

## Contas e acesso (D023)

- Cada cliente é dono do número e da conta do WhatsApp Business (WABA), no portfólio dele na
  Meta. A Meta cobra as mensagens na forma de pagamento do cliente (custo repassado, D007).
- O cliente conecta o número pelo cadastro incorporado da Meta (Embedded Signup v4) numa página
  da Zenvolyx, com coexistência: continua usando o app WhatsApp Business no celular, no mesmo
  número, com o histórico sincronizado entre app e API.
- A Zenvolyx atua como Tech Provider. A conta continua só do cliente, e o acesso é por um token
  do cliente, guardado como credencial do n8n e usado só pela porta dele (D023). Cada envio usa o
  `phoneNumberId` da config do cliente.
- Antes do primeiro cliente real: verificação da empresa na Meta, app aprovado com acesso
  avançado a `whatsapp_business_messaging` e `whatsapp_business_management`, produção com HTTPS e
  o fluxo de cadastro ([whatsapp-cadastro.md](whatsapp-cadastro.md)).
- Até lá, desenvolvimento e demo usam o app da Zenvolyx com o número de teste da Meta; a porta da
  Zenvolyx usa o token da própria agência. Conta da própria agência não precisa de acesso avançado.

## Entrada (D016)

- Um único webhook no n8n recebe os eventos de todos os clientes do app.
- GET: responde ao desafio de verificação da Meta (`hub.verify_token`).
- POST: responde 200 na hora e depois confere a assinatura `X-Hub-Signature-256` (HMAC SHA-256 do
  corpo com o App Secret). Assinatura inválida: descarta e alerta.
- Campos assinados no app: `messages` e, para clientes em coexistência, `smb_message_echoes`
  (mensagens que a equipe envia pelo app). `history`, `smb_app_state_sync` e `account_update`
  também chegam, por causa do cadastro ([whatsapp-cadastro.md](whatsapp-cadastro.md)): a entrada
  confirma e descarta. O histórico sincronizado no cadastro não é guardado (D013).
- Descarta eventos repetidos pelo ID da mensagem (`wamid`); a Meta reenvia o que não confirmou.
- Identifica o cliente pelo `metadata.phone_number_id` (D014) e o lead pelo BSUID
  (`from_user_id` / `user_id`). O telefone (`from` / `wa_id`) pode não vir, porque o usuário pode
  usar nome de usuário. Telefone e nome do perfil, quando vêm, seguem só para o CRM (D017). Se o
  lead trocar de número, o BSUID muda e a conversa recomeça.
- Status: `failed` gera alerta sem dados pessoais; os demais são ignorados.
- Texto e respostas de botão ou lista seguem para a conversa. Outros tipos (áudio, imagem,
  localização) recebem a mensagem `handoff` e vão para a equipe, até existir transcrição de áudio
  (T026).

A entrada entrega à conversa um evento por lead e por rajada. Outras fontes de lead geram o mesmo
formato, com o próprio `channel` (valores fictícios):

```json
{
  "clientId": "clinica-exemplo",
  "channel": "whatsapp",
  "leadId": "BR.0000000000000000000",
  "phone": null,
  "name": null,
  "messageIds": ["wamid.exemplo1", "wamid.exemplo2"],
  "type": "text",
  "text": "Oi\nQueria marcar uma avaliação",
  "replyId": null,
  "receivedAt": "2026-09-23T12:00:00Z"
}
```

`type` é `text`, `reply` (resposta de botão ou lista, com `replyId`) ou `unsupported`. Numa rajada
com resposta de botão, vale a última.

## Rajadas

Leads costumam mandar várias mensagens seguidas. A entrada guarda cada mensagem nas tabelas
internas do n8n e espera alguns segundos de silêncio (8 s para começar). Se chegar mensagem nova
do mesmo lead, a execução anterior encerra; a última responde a tudo de uma vez. Menos respostas
são mais claras e custam menos (ver Custos).

## Atendimento humano

- A equipe responde pelo app WhatsApp Business. Cada mensagem enviada pelo app chega como
  `smb_message_echoes`, e a automação pausa aquele lead por 24 h desde a última mensagem da equipe.
- Ao enviar `handoff`, a automação também pausa o lead por 24 h.
- Em pausa, a automação não responde nem marca como lida.
- Pedido para parar (ex.: "parar", "sair") fica registrado: nenhuma mensagem iniciada pela empresa
  vai mais para esse lead.
- Sem coexistência, a equipe não teria onde responder; por isso ela é o padrão para clientes.

## Mensagens e templates

- Na janela de 24 h desde a última mensagem do lead: texto livre, botões (até 3, título até
  20 caracteres) e lista (até 10 opções, título até 24). Pergunta `choice` da config vira botões
  até 3 opções e lista acima disso; por isso a config limita opções e rótulos (clients/README.md).
- Envio pelo BSUID (campo `recipient`), que funciona com ou sem telefone.
- Fora da janela (lembrete, retorno): só template aprovado na conta do cliente, na categoria
  utilidade sempre que possível. Os templates entram na config quando a primeira automação precisar
  (lembretes: T023).

## Custos

- Desde 2026-10-01, respostas dentro da janela também são cobradas por mensagem, na tabela de
  utilidade (D007). Juntar rajadas e evitar mensagens desnecessárias reduz o custo.
- A Meta tem uma IA própria no WhatsApp (Meta Business Agent), cobrada por token desde 2026-08-01;
  descartada por ora (D019, [ia.md](ia.md)).

## Limites da coexistência (avisar o cliente)

- No cadastro, os aparelhos conectados (ex.: WhatsApp Web) são desconectados, e o WhatsApp para
  Windows deixa de ser suportado.
- Nas conversas individuais ficam desativadas: mensagens temporárias, visualização única e
  localização em tempo real. Não dá para criar listas de transmissão novas.
- O celular com o app precisa ser aberto com frequência: após cerca de 14 dias sem uso, a
  conexão cai.
- A sincronização de histórico e contatos precisa acontecer em até 24 h após o cadastro (T017).
- Vazão fixa de 20 mensagens por segundo, folgada para o nosso volume.

## Desenvolvimento

- App da Zenvolyx na Meta com o número de teste, webhook apontando para o túnel do n8n local (T012).
- Payloads fictícios em `tests/fixtures/whatsapp/`: texto, resposta de botão, rajada, eco da
  equipe, status `failed` e assinatura inválida.

## Referências

- [Coexistência](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [BSUID e nomes de usuário](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/)
- [Preço das mensagens fora de template](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)
- [Tokens de acesso](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/)
