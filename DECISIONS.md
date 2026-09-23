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

## D006 n8n self-hosted, começando no computador local
Data: 2026-09-23 | Status: Aceita | Tarefa: — (definido pelo dono)
Contexto: O custo inicial precisa ser zero. O n8n Community Edition é gratuito quando auto-hospedado; o n8n Cloud é pago.
Decisão: Desenvolver com o n8n no computador local (Docker). No primeiro cliente, migrar para Oracle Cloud Always Free ou VPS barata (decidir nesse momento). Clientes nunca acessam o n8n: recebem só os resultados das automações.
Consequências: Webhooks locais precisam de túnel (ex.: Cloudflare Tunnel). A licença permite o modelo de agência se o cliente não acessa o n8n; antes do primeiro cliente, confirmar com license@n8n.io o caso de guardar credenciais de clientes na nossa instância.

## D007 WhatsApp pela API oficial da Meta
Data: 2026-09-23 | Status: Aceita | Tarefa: — (definido pelo dono)
Contexto: APIs não oficiais (Evolution API, Z-API) são mais baratas, mas violam os termos do WhatsApp e arriscam o banimento do número do cliente.
Decisão: Usar a WhatsApp Business Platform (Cloud API) oficial, desenvolvendo com o número de teste gratuito da Meta. O custo das mensagens é repassado ao cliente; a forma (conta do cliente ou da agência) se define em T007.
Consequências: Mensagem iniciada pela empresa exige template aprovado, e marketing é a categoria mais cara. A partir de 2026-10-01, respostas dentro da janela de 24h também são cobradas: priorizar fluxos em que o lead inicia a conversa.

## D008 CRM definido por cliente
Data: 2026-09-23 | Status: Aceita | Tarefa: — (definido pelo dono)
Contexto: Cada cliente pode já usar um CRM diferente, ou só planilha e WhatsApp.
Decisão: Não adotar um CRM padrão. Integrar com o que o cliente usa; para quem não usa nenhum, Google Sheets ou um CRM gratuito. O padrão de integração se define em T008.
Consequências: A integração com CRM precisa ser plugável: cada CRM novo vira um conector novo, não um fluxo novo.
