# Zenvolyx

Agência de automação com IA para negócios de serviço que vendem pelo WhatsApp e trabalham
com agendamento. Este repositório reúne as automações (n8n), as integrações (WhatsApp, CRM)
e a configuração de cada cliente.

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
