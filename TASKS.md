# TASKS.md

Fila central de trabalho. Regras: `AGENTS.md`, seções 6 e 7.
Tarefas curtas. Detalhes ficam na documentação da área (linha `Ref:`).

Formato (linhas de baixo são opcionais):

```
- [ ] T000 Descrição curta
  Depende: T000 | Sugerido: CLAUDE ou CODEX | Ref: caminho/do/doc.md
```

## Backlog

- [ ] T001 Inicializar Git com `main` e `dev`, `.gitignore` e `.env.example` vazio
  Sugerido: CODEX
- [ ] T002 Propor stack (linguagem, runtime, testes, lint) e registrar em DECISIONS.md
  Sugerido: CLAUDE | Ref: DECISIONS.md (D006)
- [ ] T003 Criar estrutura de pastas da seção 3 do AGENTS.md com README curto em cada uma
  Depende: T001, T002 | Sugerido: CODEX
- [ ] T004 Configurar testes e lint; preencher os comandos na seção 1 do AGENTS.md
  Depende: T003 | Sugerido: CODEX
- [ ] T005 Desenhar arquitetura das automações (n8n, serviços, integrações) em docs/arquitetura/
  Depende: T002 | Sugerido: CLAUDE
- [ ] T006 Definir estrutura reutilizável de clientes (clients/) e registrar decisão
  Depende: T005 | Sugerido: CLAUDE
- [ ] T007 Definir abordagem de integração com WhatsApp (API oficial) e registrar decisão
  Depende: T005 | Sugerido: CLAUDE | Ref: DECISIONS.md (D007)
- [ ] T008 Definir abordagem de integração com CRM e registrar decisão
  Depende: T005 | Sugerido: CLAUDE | Ref: DECISIONS.md (D008)
- [ ] T009 Especificar a demo da Zenvolyx (a própria agência como cliente: lead chama no WhatsApp,
  é qualificado, agendado e registrado no CRM) e quebrar em tarefas de implementação. Prioridade alta.
  Depende: T006, T007, T008 | Sugerido: CLAUDE

## Em andamento

_(vazio)_

## Concluído

<!-- Manter só as ~20 mais recentes. Mais antigas: mover para docs/tasks-arquivo.md. -->

- [x] T000 Criar estrutura de contexto (AGENTS, CLAUDE, CODEX, TASKS, DECISIONS, README)

## Handoffs

<!-- Remover o handoff quando a "Próxima tarefa" dele for concluída. Formato:

### Handoff T031
Concluído:
- webhook criado
- payload validado
Arquivos principais:
- services/leads/webhook.ts
Próxima tarefa: T032
Observações:
- ...
-->

_(nenhum)_
