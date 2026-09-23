# Integrações

Conectores reutilizáveis para WhatsApp e CRM. Diferenças de clientes ficam em
`clients/<cliente>/`. Ainda não há conectores implementados.

Como rodar: seguir o README de cada conector quando ele for criado.
A stack de código segue D009; instalar as dependências com `npm ci` na raiz.

Como testar: validar entradas externas e cobrir sucesso e falha com dados
fictícios, sem registrar payloads completos. Rodar `npm test` na raiz e conferir
lint e tipos com `npm run lint` e `npm run typecheck`.
