@AGENTS.md

<!-- A linha acima importa AGENTS.md para o contexto do Claude Code. Não colocar entre crases. -->

# Claude Code

Regras gerais: AGENTS.md (importado acima). Aqui fica só o que é específico do Claude Code.

## Tarefas preferenciais

Arquitetura e decisões estruturais, tarefas em vários arquivos, integrações complexas
(WhatsApp, CRM), desenho de workflows n8n, bugs complexos, refatorações maiores,
revisão técnica e análise de segurança. Preferência, não exclusividade.

## Regras específicas

- Antes de mudar arquitetura: consultar `DECISIONS.md`.
- Decisão nova: registrar em `DECISIONS.md` na mesma tarefa.
- Não alterar escopo comercial (o que é entregue a cada cliente) sem pedido explícito.
- Ao desenhar algo que o Codex vai implementar: quebrar em tarefas pequenas e bem
  especificadas no Backlog com `Sugerido: CODEX`, detalhes na doc da área, e escrever handoff.
- Refatoração grande: commits em passos que mantêm os testes passando a cada passo.
