# TASKS.md

Fila central de trabalho. Regras: `AGENTS.md`, seções 6 e 7.
Tarefas curtas. Detalhes ficam na documentação da área (linha `Ref:`).

Formato (linhas de baixo são opcionais):

```
- [ ] T000 Descrição curta
  Depende: T000 | Sugerido: CLAUDE ou CODEX | Ref: caminho/do/doc.md
```

## Backlog

- [ ] T007 Definir abordagem de integração com WhatsApp (API oficial) e registrar decisão
  Depende: T005 | Sugerido: CLAUDE | Ref: DECISIONS.md (D007), docs/arquitetura/visao-geral.md
- [ ] T008 Definir abordagem de integração com CRM e registrar decisão
  Depende: T005 | Sugerido: CLAUDE | Ref: DECISIONS.md (D008), docs/arquitetura/visao-geral.md
- [ ] T009 Especificar a demo da Zenvolyx (a própria agência como cliente: lead chama no WhatsApp,
  é qualificado, agendado e registrado no CRM) e quebrar em tarefas de implementação. Prioridade alta.
  Depende: T006, T007, T008, T010, T011 | Sugerido: CLAUDE
- [ ] T010 Definir abordagem de agendamento (contrato do conector de agenda e primeiro fornecedor) e registrar decisão
  Depende: T005 | Sugerido: CLAUDE | Ref: docs/arquitetura/visao-geral.md
- [ ] T011 Definir o uso de IA na conversa (papel, provedor, custo e limites de dados) e registrar decisão
  Depende: T005 | Sugerido: CLAUDE | Ref: docs/arquitetura/visao-geral.md, DECISIONS.md (D013)
- [ ] T012 Montar o n8n local com Docker em `infra/n8n/` (versão fixa, `.env`, túnel, retenção de execuções), com passo a passo no README
  Depende: T005 | Sugerido: CODEX | Ref: docs/arquitetura/visao-geral.md (Ambientes), DECISIONS.md (D006, D013)
- [ ] T013 Criar verificação automática dos workflows exportados (sem credenciais, tokens ou `pinData`) em `scripts/`, com testes
  Depende: T005 | Sugerido: CODEX | Ref: docs/arquitetura/visao-geral.md (Ciclo de um workflow)
- [ ] T014 Fazer `npm run lint` passar numa cópia do repositório no Windows (arquivos com CRLF), via `.gitattributes` ou config do Biome
  Sugerido: CODEX

## Em andamento

- [ ] T006 Definir estrutura reutilizável de clientes (clients/) e registrar decisão [CLAUDE]
  Depende: T005 | Sugerido: CLAUDE | Ref: docs/arquitetura/visao-geral.md (D012)

## Concluído

<!-- Manter só as ~20 mais recentes. Mais antigas: mover para docs/tasks-arquivo.md. -->

- [x] T005 Desenhar arquitetura das automações (n8n, serviços, integrações) em docs/arquitetura/
  Ref: docs/arquitetura/visao-geral.md, DECISIONS.md (D011 a D013)
  Validação: `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia com fim de linha LF (na pasta do Windows falha por CRLF, já antes desta tarefa: T014); 5 links locais válidos. Diagrama Mermaid não conferido em renderizador.

- [x] T004 Configurar testes e lint; preencher os comandos na seção 1 do AGENTS.md
  Ref: DECISIONS.md (D009 aceita pelo dono), README.md (Desenvolvimento)
  Validação: `npm ci`, `npm test` (1 teste), `npm run lint` e `npm run typecheck` passaram; verificações temporárias confirmaram que as ferramentas rejeitam asserção incorreta, `debugger` e erro de tipo.
  Ambiente: Node.js 24.19.0; npm 12.1.0 temporário para validação, pois não estava disponível no PATH. Nenhuma instalação global alterada.
- [x] T003 Criar estrutura de pastas da seção 3 do AGENTS.md com README curto em cada uma
  Ref: DECISIONS.md (D010)
  Validação: 9 pastas com READMEs de propósito, uso e validação; 5 links locais válidos; `git diff --cached --check` passou. Suíte automatizada pendente da T004.
- [x] T001 Inicializar Git com `main` e `dev`, `.gitignore` e `.env.example` vazio
  Validação: 15 casos de ignore, `.env.example` vazio e `git diff --cached --check` passaram.
  Remoto: `origin` configurado para `https://github.com/Gugrgg/Zenvolyx.git`; sem push, pois a consulta retornou `Repository not found`.
- [x] T002 Propor stack (linguagem, runtime, testes, lint) e registrar em DECISIONS.md
  Ref: DECISIONS.md (D009)
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

### Handoff T005
Concluído:
- arquitetura em docs/arquitetura/visao-geral.md; decisões D011 a D013
- tarefas derivadas: T010 e T011 (Claude); T012, T013 e T014 (Codex)
Arquivos principais:
- docs/arquitetura/visao-geral.md
- DECISIONS.md (D011 a D013)
Próxima tarefa: T012
Observações:
- T012: `infra/` é pasta nova; registrar em DECISIONS.md e na seção 3 do AGENTS.md. Imagem do n8n com versão fixa; porta só em `127.0.0.1`; dados num volume; `N8N_ENCRYPTION_KEY`, `WEBHOOK_URL` e fuso `America/Sao_Paulo` via `.env`, com os nomes no `.env.example`. Retenção conforme D013 (ex.: `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`, `EXECUTIONS_DATA_MAX_AGE=168`). Confirmar que a versão escolhida tem tabelas internas (Data tables). README em passos simples: o dono tem experiência básica com terminal (AGENTS.md, seção 4).
- T013: ainda não há workflows; validar com fixtures fictícias em `tests/fixtures/workflows/` (um limpo, um com `pinData`, um com token num parâmetro). O erro aponta arquivo e nó, sem imprimir o valor suspeito.
- Nesta máquina não há Node no PATH; a validação da T005 usou o Node 24 do runtime do Codex.
