# Integrações

Conectores reutilizáveis para WhatsApp, CRM e agenda (D011). Cada conector é um
sub-workflow do n8n em `integrations/<tipo>/<fornecedor>/`; o contrato de entrada e
saída do tipo fica em `integrations/<tipo>/README.md`. Diferenças de clientes ficam em
`clients/<cliente>/`. Ainda não há conectores implementados.
Desenho: [visão geral da arquitetura](../docs/arquitetura/visao-geral.md).

Como rodar: seguir o README de cada conector quando ele for criado, importando o
JSON no n8n local. Conector em TypeScript é exceção (D011) e segue a stack D009,
com as dependências instaladas por `npm ci` na raiz.

Como testar: validar entradas externas e cobrir sucesso e falha com dados
fictícios em `tests/fixtures/`, sem registrar payloads completos. Cada conector
documenta seu roteiro de verificação; código TypeScript também passa por
`npm test`, `npm run lint` e `npm run typecheck` na raiz.
