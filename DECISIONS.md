# DECISIONS.md

Decisões técnicas, curtas. Consultar antes de mudar arquitetura.
Nunca editar uma decisão aceita: criar uma nova e marcar a antiga como `Substituída por Dxxx`.

Formato:

```
## D000 Título
Data: AAAA-MM-DD | Status: Aceita | Tarefa: T000
Contexto: 1–2 linhas.
Decisão: 1–3 linhas.
Consequências: 1–2 linhas.
```

---

## D001 Repositório como memória do projeto
Data: 2026-09-23 | Status: Aceita | Tarefa: T000
Contexto: Claude Code e Codex alternam no desenvolvimento e não compartilham memória entre sessões.
Decisão: O estado do projeto vive em arquivos. AGENTS.md = regras compartilhadas; CLAUDE.md e CODEX.md = só o específico de cada agente; TASKS.md = fila única; DECISIONS.md = decisões.
Consequências: Tudo que importa precisa ir para arquivo; o combinado só em conversa não vale.

## D002 AGENTS.md como arquivo carregado pelos dois agentes
Data: 2026-09-23 | Status: Aceita | Tarefa: T000
Contexto: Codex carrega AGENTS.md automaticamente. Com um CLAUDE.md no repo, o Claude Code carrega o CLAUDE.md, e não o AGENTS.md.
Decisão: CLAUDE.md começa com `@AGENTS.md` (import). AGENTS.md aponta o Codex para CODEX.md.
Consequências: Os dois agentes começam com as mesmas regras, sem duplicação. O import não pode ficar entre crases.

## D003 Um agente por tarefa, com trava em TASKS.md
Data: 2026-09-23 | Status: Aceita | Tarefa: T000
Contexto: Dois agentes editando a mesma área geram conflito e trabalho duplicado.
Decisão: Antes de codar, a tarefa vai para "Em andamento" com `[CLAUDE]` ou `[CODEX]`. O outro agente não toca nela.
Consequências: Se os agentes usam cópias diferentes do repo, a mudança em TASKS.md precisa de commit e push em `dev` antes de começar.

## D004 Git: main, dev e branch por tarefa
Data: 2026-09-23 | Status: Aceita | Tarefa: T000
Contexto: Precisamos de histórico legível e de um ponto estável.
Decisão: `main` estável, `dev` integração, `feature/TXXX-...` e `fix/TXXX-...` para mudanças significativas, commits `tipo(TXXX): ...`.
Consequências: Merge em `main` só com autorização do usuário.

## D005 Handoffs ficam em TASKS.md
Data: 2026-09-23 | Status: Aceita | Tarefa: T000
Contexto: Handoffs precisam estar onde os agentes já leem no início da sessão.
Decisão: Seção "Handoffs" no fim de TASKS.md; cada handoff é removido quando a próxima tarefa é concluída.
Consequências: Nenhum arquivo extra para ler; TASKS.md não cresce indefinidamente.

## D006 Stack: n8n self-hosted + Node.js 24 LTS com TypeScript
Data: 2026-09-23 | Status: Proposta (aguarda confirmação do usuário) | Tarefa: T002
Contexto: Precisamos de uma stack única para `services/`, `integrations/` e `scripts/`, próxima do n8n e com poucas dependências.
Decisão: Orquestração no n8n self-hosted (Docker Compose, banco Postgres). Código em Node.js 24 LTS + TypeScript `strict`, pacote único na raiz com npm (sem monorepo). TS roda direto no Node (type stripping: `erasableSyntaxOnly`, imports com `.ts`); `tsc --noEmit` só para checagem de tipos. Testes com Vitest; lint e format com Biome; validação de payload externo com Zod; `.env` lido com `node --env-file` (sem dotenv). Framework HTTP só é escolhido quando surgir o primeiro endpoint.
Consequências: Mesma linguagem dos Code nodes do n8n e poucas dependências (typescript, vitest, biome, zod). Comandos-alvo para T004: `npm test`, `npm run lint`, `npm run typecheck`. Sem enums/namespaces de TS por causa do type stripping.
