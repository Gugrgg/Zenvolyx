# Testes

Testes automatizados e fixtures do projeto, sempre com dados fictícios.
Vitest executa os arquivos `*.test.ts`; importe `test` e `expect` de `vitest`.

Como rodar: após `npm ci` na raiz, usar `npm test` para a suíte completa ou
`npm test -- tests/runtime.test.ts` para o teste inicial. Ele verifica se o Node
executa módulos TypeScript com imports locais e de tipos, sem build ou loader,
usando arquivos temporários removidos ao final.

Payloads de exemplo para workflows devem ficar em `tests/fixtures/` quando criados;
os passos de verificação ficam no README da respectiva automação.

Como validar: rodar os testes relacionados a cada mudança e a suíte completa
antes de integrar em `dev`, além de `npm run lint` e `npm run typecheck`.
Nunca usar dados reais de leads ou clientes nas fixtures.
