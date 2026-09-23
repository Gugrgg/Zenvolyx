# Automações

Workflows n8n exportados em JSON, organizados em `automations/<nome>/`.
Ainda não há workflows implementados.

Como rodar: quando houver uma automação, seguir o README da sua pasta para
importar e executar o workflow no n8n local (Docker, D006).

Como testar: cada automação deve documentar os passos de verificação e usar
payloads fictícios em `tests/fixtures/`. Exportar o JSON após cada alteração,
conferindo que não contém tokens ou credenciais. Antes de commitar, executar
`npm run check:workflows` (também cobre os conectores em `integrations/`).
Remover `credentials` e `pinData` do JSON, mesmo vazios; detalhes e limitações no
[verificador](../scripts/README.md#verificar-workflows-exportados).
