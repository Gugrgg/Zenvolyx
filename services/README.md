# Serviços

APIs pequenas e webhooks reutilizáveis, sem regras específicas de clientes.
Ainda não há serviços implementados.

Como rodar: seguir o README de cada serviço quando ele for criado, incluindo
as variáveis necessárias (nomes em `.env.example`, valores em `.env`).
A stack de código segue D009; instalar as dependências com `npm ci` na raiz.

Como testar: cobrir entradas válidas e inválidas e falhas das dependências com
dados fictícios. Rodar `npm test` na raiz e conferir lint e tipos com
`npm run lint` e `npm run typecheck`.
