# CODEX.md

Regras gerais: `AGENTS.md`. Aqui fica só o que é específico do Codex.

## Tarefas preferenciais

Tarefas isoladas e claramente especificadas: scripts auxiliares, ferramentas internas,
APIs pequenas, endpoints, webhooks, integrações específicas, transformação e validação
de payload, testes, correção de bugs e pequenas melhorias. Preferência, não exclusividade.

## Regras específicas

- Não refatorar partes do projeto fora da tarefa. Achou algo a melhorar: criar tarefa no Backlog.
- Especificação ambígua ou que exige decisão de arquitetura: não decidir sozinho.
  Anotar a dúvida na tarefa, sugerir `CLAUDE` ou perguntar ao usuário, e parar.
- Não alterar estrutura de pastas nem `DECISIONS.md`, salvo se a tarefa pedir.
- Tarefa com handoff: ler o handoff antes de qualquer outro arquivo.
