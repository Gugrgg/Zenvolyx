# Cadastro de clientes reais no WhatsApp

Como um cliente real conecta o número dele à Zenvolyx (D023). Regras da Meta conferidas na
documentação oficial em 2026-09 (links no fim). A demo, com número da própria agência, não depende
de nada disto.

## Resumo

1. A Zenvolyx vira Tech Provider na Meta (uma vez).
2. O cliente abre o link de convite e conecta o número pelo cadastro incorporado v4, escolhendo
   continuar no app WhatsApp Business (coexistência).
3. O n8n troca o código pelo token do cliente em até 30 segundos, cria a credencial e a porta do
   cliente, assina os webhooks da conta dele e pede a sincronização de contatos e histórico.
4. O cliente cadastra a forma de pagamento no WhatsApp Manager; a agência preenche a config e ativa.

## Pré-requisitos da Zenvolyx (dono, uma vez)

- Portfólio empresarial da Zenvolyx verificado na Meta, com nome, endereço, telefone, e-mail e
  site; a Meta pode pedir documentos da empresa.
- Site com política de privacidade, cujo endereço vai nas configurações do app.
- O app da Meta (o mesmo da demo) com o caso de uso WhatsApp, ícone, política de privacidade e
  categoria, ligado ao portfólio e publicado (modo Live).
- Revisão do app com acesso avançado a `whatsapp_business_messaging` (vídeo: mensagem enviada pelo
  app chegando no WhatsApp) e `whatsapp_business_management` (vídeo: template criado pelo app).
  A Meta informa resposta média de 24 h; `whatsapp_business_manage_events` vem junto.
- Configuração do Facebook Login for Business para o cadastro incorporado v4, que gera o
  `config_id`, com o domínio da página em "Allowed domains" e "Valid OAuth redirect URIs".
- Webhooks do app assinados: `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync` e
  `account_update`.
- Produção com domínio e HTTPS estáveis (T032): a página e os webhooks exigem certificado válido,
  e a URL do túnel de testes muda a cada vez.
- Chave da API do n8n guardada como credencial do n8n, para o cadastro criar credencial e porta.
- Limite da Meta: 10 clientes novos a cada 7 dias, que sobe para 200 depois da verificação.

## Convite

- Para cada cliente, a agência cria um convite numa tabela interna do n8n: `clientId`, código
  aleatório, validade (ex.: 7 dias) e se já foi usado.
- Link: `https://<domínio>/webhook/whatsapp-cadastro?convite=<código>`.
- Convite inválido, vencido ou já usado não abre o cadastro.

## Página de cadastro

- Servida pelo próprio n8n (webhook que devolve HTML), no domínio de produção.
- SDK JavaScript da Meta: `FB.init` com a versão da Graph API fixa (v25.0 em 2026-09) e `FB.login`
  com `config_id`, `response_type: "code"`, `override_default_response_type: true` e
  `extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }`.
  Sem o `featureType`, o cliente não vê a opção de manter o app.
- Ouve a mensagem `WA_EMBEDDED_SIGNUP` só de origens terminadas em `facebook.com`.
  `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` (coexistência) ou `FINISH` trazem `waba_id` e
  `phone_number_id`; `CANCEL` e `ERROR` mostram orientação ao cliente e avisam a agência.
- Com o código e os IDs em mãos, envia na hora `{ convite, code, wabaId, phoneNumberId }` ao
  webhook de cadastro: o código vale só 30 segundos.
- IDs do app e da configuração não são secretos; o App Secret nunca vai para a página.

## Fluxo de cadastro (n8n)

1. Confere o convite e o marca como usado.
2. Troca o código pelo token do cliente: `GET /oauth/access_token` com `client_id`, `code` e o
   `client_secret`, que fica numa credencial do n8n.
3. Cria a credencial e a porta do cliente pela API do n8n, publica a porta e registra
   `clientId → porta` numa tabela interna.
4. Pela porta, assina os webhooks da conta: `POST /<WABA_ID>/subscribed_apps`.
5. Com coexistência, o número não é registrado de novo, porque já está no app. O fluxo pede a
   sincronização em `POST /<PHONE_NUMBER_ID>/smb_app_data`, primeiro com `sync_type`
   `smb_app_state_sync` (contatos) e depois `history`, em até 24 h; passado o prazo, a Meta exige
   desconectar o cliente. O histórico que chega pelo webhook não é guardado (D013). Se o cliente
   não compartilhar o histórico, a Meta avisa com o erro 2593109, e o cadastro segue.
   Com número novo, sem app: registrar em `POST /<PHONE_NUMBER_ID>/register` com PIN de 6 dígitos.
6. Avisa a agência (T027) com cliente, `phoneNumberId` e `wabaId`, nunca com o token.

O workflow de cadastro não salva dados de execução, nem em erro, porque o token passa por ele.
Falha em qualquer passo gera aviso à agência, que manda um convite novo.

## Depois do cadastro

- O cliente cadastra a forma de pagamento no WhatsApp Manager; sem ela, o cadastro não termina.
- A agência preenche `whatsapp.phoneNumberId` em `clients/<id>/config.json`, valida com
  `npm run check:clients`, testa com lead fictício e ativa o cliente.
- Avisar o cliente sobre os limites da coexistência ([whatsapp.md](whatsapp.md)).

## Token e porta do cliente (D023)

- O token do cliente (business integration system user) só serve para aquele cliente, e é o que a
  Meta recomenda para Tech Providers. A conta continua do cliente, sem ser compartilhada com o
  portfólio da Zenvolyx; por isso o token da própria agência não a alcança.
- Os nós do n8n não escolhem credencial durante a execução (D014). Por isso cada cliente tem uma
  porta: sub-workflow com um nó HTTP Request usando a credencial dele. Entrada
  `{ "method", "path", "body" }`, com `path` relativo a `https://graph.facebook.com/v25.0` (a porta
  recusa outro destino); saída `{ "status", "body" }`.
- O conector de WhatsApp (T018) acha a porta pelo `clientId` na tabela e chama por ela.
- A Zenvolyx, na demo, usa o mesmo desenho: porta criada à mão com o token de usuário do sistema
  da própria agência.
- Erro de autenticação (token revogado ou vencido; a Meta não informa validade) gera aviso à
  agência e desativa o cliente até um novo cadastro.

## Tarefas

| Tarefa | Quem | O quê |
|--------|------|-------|
| T032 | Claude | Especificar a produção: servidor, domínio com HTTPS, backup e atualização |
| T033 | Codex | Porta do cliente: modelo e sub-workflow que cria credencial e porta pela API do n8n |
| T018 | Codex | Conector de WhatsApp chamando a Graph API pela porta do cliente |
| T034 | Codex | Fluxo de cadastro: convite, página, troca do código, porta, webhooks, sincronização e aviso |

## Referências

- [Tornar-se Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- [Revisão do app](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review)
- [Cadastro incorporado: visão geral](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [Cadastro incorporado: implementação](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation)
- [Cadastro incorporado: versão 4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4)
- [Passos depois do cadastro (Tech Provider)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider)
- [Coexistência](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Tokens de acesso](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/)
