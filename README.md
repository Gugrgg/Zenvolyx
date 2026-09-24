# Zenvolyx

Agência de automação com IA para negócios de serviço que vendem pelo WhatsApp e trabalham
com agendamento. Este repositório reúne as automações (n8n), as integrações (WhatsApp, CRM)
e a configuração de cada cliente.

Objetivo atual: conseguir o primeiro cliente odontológico pagando pela Zenvolyx, com uma demo
numa clínica fictícia (D025). Prioridades e fase comercial no [TASKS.md](TASKS.md).

## Desenvolvimento

Pré-requisitos: Node.js 24 LTS com npm. Na raiz do repositório, `npm ci` instala
as versões registradas no `package-lock.json`.

Depois da instalação, execute na raiz:

| Comando | Verificação |
|---------|-------------|
| `npm test` | Executa os testes uma vez, sem modo de observação. |
| `npm run lint` | Confere lint, formatação e imports com Biome, sem alterar arquivos. |
| `npm run typecheck` | Confere os tipos com TypeScript, sem gerar JavaScript. |

Para corrigir formatação e imports, use `npm exec -- biome check --write .` e
revise as alterações. As três verificações acima devem passar antes de integrar mudanças.

O [.gitattributes](.gitattributes) mantém arquivos de texto com finais de linha LF
também no Windows, alinhados ao Biome, mesmo com `core.autocrlf=true`.
Em cópias antigas com CRLF, `npm exec -- biome format --write .` normaliza a
formatação dos arquivos verificados; depois execute `npm run lint`.

O código usa módulos ESM (`"type": "module"`) e pode executar arquivos `.ts`
diretamente no Node, sem build. Use extensões `.ts` nos imports locais e
`import type` para tipos; não use sintaxe que exija transformação, como enums.
Essas restrições seguem o [suporte a TypeScript do Node.js](https://nodejs.org/docs/latest-v24.x/api/typescript.html).

A suíte inicial verifica a execução de TypeScript no Node. Ainda não há serviços,
conectores ou workflows implementados. Para configurar o n8n com Docker, seguir o
[passo a passo do ambiente local](infra/n8n/README.md) (D006, T012).

## Trabalhando com agentes

| Arquivo        | Papel                                                   |
|----------------|---------------------------------------------------------|
| `AGENTS.md`    | Regras compartilhadas (carregado pelos dois agentes)    |
| `CLAUDE.md`    | Específico do Claude Code; importa `AGENTS.md`          |
| `CODEX.md`     | Específico do Codex                                     |
| `TASKS.md`     | Fila de trabalho e handoffs                             |
| `DECISIONS.md` | Decisões técnicas                                       |

### Iniciar sessão no Claude Code

> Leia AGENTS.md e TASKS.md. Escolha a próxima tarefa marcada para Claude ou a próxima tarefa adequada às suas capacidades. Leia apenas os arquivos necessários para ela. Implemente, teste e atualize TASKS.md. Não altere escopo não relacionado.

### Iniciar sessão no Codex

> Leia AGENTS.md e TASKS.md. Pegue a próxima tarefa marcada para Codex ou uma tarefa técnica pequena disponível. Leia somente o contexto necessário. Implemente, teste e atualize TASKS.md. Não altere partes não relacionadas.
