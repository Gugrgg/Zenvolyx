# Scripts

Scripts auxiliares e ferramentas internas.

Como rodar: cada script deve documentar seu comando, argumentos e variáveis
necessárias. A stack de código segue D009; instalar as dependências com `npm ci`
na raiz.

Como testar: executar os testes relacionados ao script com entradas fictícias.
Usar `npm test -- caminho/do/teste.test.ts` na raiz; conferir também lint e tipos
com `npm run lint` e `npm run typecheck`.

## Verificar workflows exportados

`npm run check:workflows` verifica recursivamente os JSON de `automations/` e
`integrations/`. Para verificar um arquivo ou outra pasta:
`npm run check:workflows -- caminho/workflow.json`. Aceita exportação única do
editor e lista de workflows da CLI. Saída 0 indica sucesso; 1 indica problema.
Sem arquivos, informa que verificou zero; não valida fixtures inválidas por padrão.

Remover os campos `credentials` (inclusive referências por ID) e `pinData`, mesmo
vazios, antes do commit. O script também detecta campos sensíveis com valores
literais, headers/parâmetros de autenticação, tokens conhecidos, chaves privadas,
autenticação em URLs e alguns segredos em código/texto. Campos vazios e referências
diretas como `={{ $env.API_KEY }}` são aceitos; os valores devem ficar no ambiente
ou no cofre do n8n. Credenciais são associadas novamente após importar.

Erros mostram arquivo, posição do workflow e posição do nó (a partir de 1), sem
exibir nome do nó, valor suspeito ou conteúdo do JSON. Problemas no nível superior,
como `pinData`, aparecem como raiz do workflow.

É uma verificação estática preventiva, não uma garantia de ausência de segredos:
valores ofuscados ou em campos genéricos podem escapar. Revisar o diff antes de
commitar. O script não altera nem limpa arquivos automaticamente.

`npm test -- tests/check-workflows.test.ts` testa fixtures fictícias, falhas da CLI
e os exports reais do repositório. A suíte completa também executa essa verificação.
