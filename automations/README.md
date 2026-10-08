# Automações

Workflows n8n exportados em JSON, organizados em `automations/<nome>/`, cada um com
ID fixo e export limpo (D022).

- [load-client-config](load-client-config/README.md): acha o cliente ativo pelo número
  de WhatsApp e devolve a config (T016).
- [whatsapp-inbound](whatsapp-inbound/README.md): entrada do WhatsApp, com verificação da
  Meta, assinatura, deduplicação e cliente identificado (T019).
- [lead-conversation](lead-conversation/README.md): conversa, qualificação, agendamento e encaminhamento
  com estado persistente (T028/T029), ligada à saída da entrada do WhatsApp.

Como rodar: seguir o README da pasta para importar e publicar o workflow no n8n
local (Docker, D006; [comandos da CLI](../infra/n8n/README.md#7-comandos-da-cli-do-n8n)).
Sub-workflows só podem ser chamados depois de publicados.

Como testar: cada automação deve documentar os passos de verificação e usar
payloads fictícios em `tests/fixtures/`. Exportar o JSON após cada alteração,
conferindo que não contém tokens ou credenciais. Antes de commitar, executar
`npm run check:workflows` (também cobre os conectores em `integrations/`).
Remover `credentials` e `pinData` do JSON, mesmo vazios; detalhes e limitações no
[verificador](../scripts/README.md#verificar-workflows-exportados).
