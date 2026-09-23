# AGENTS.md

Regras compartilhadas entre Claude Code e Codex. Fonte principal de contexto do projeto.
O estado real do projeto está no repositório. Histórico de conversa não é memória.

- **Codex:** leia também `CODEX.md` (regras específicas, curtas).
- **Claude Code:** `CLAUDE.md` já importa este arquivo.

## 1. Projeto

**Zenvolyx**: agência de automação com IA para negócios de serviço que vendem pelo WhatsApp
e trabalham com agendamento (clínicas, escritórios, cursos, academias etc.).
Automatiza captação, qualificação, agendamento e encaminhamento de leads com n8n, WhatsApp
e CRM, com uma estrutura reutilizável entre clientes.

- Premissas: n8n self-hosted (D006), WhatsApp pela API oficial da Meta (D007), CRM definido por cliente (D008).
- Stack: Node.js 24 LTS + TypeScript, npm, Vitest e Biome (D009 aceita); Zod instalado na T015 para validar as configs de clientes e reutilizar nas entradas externas.
- Testes: `npm test` (Vitest).
- Lint/format: `npm run lint` (Biome, sem alterar arquivos).
- Tipos: `npm run typecheck` (TypeScript, sem gerar arquivos).

## 2. Início de sessão (economia de tokens)

1. Ler `AGENTS.md` e `TASKS.md`.
2. Escolher a tarefa (seção 6).
3. Abrir **somente** os arquivos necessários para essa tarefa.

Não ler a documentação inteira. Não ler `docs/comercial/` salvo se a tarefa exigir.
Ler `DECISIONS.md` só quando a tarefa mexer em arquitetura, estrutura ou algo já decidido.

| Tarefa envolve     | Ler também                                        |
|--------------------|---------------------------------------------------|
| n8n                | `automations/README.md` + pasta da automação      |
| WhatsApp / CRM     | `integrations/README.md` + pasta da integração    |
| API / webhook      | `services/README.md` + arquivos do endpoint       |
| script             | o script e seus testes                            |
| cliente específico | `clients/<cliente>/README.md`                     |
| arquitetura        | `DECISIONS.md` + README das áreas afetadas        |
| tarefa com handoff | o handoff em `TASKS.md` antes de qualquer arquivo |

## 3. Estrutura de pastas

```
.
├── AGENTS.md  CLAUDE.md  CODEX.md  TASKS.md  DECISIONS.md  README.md
├── .env.example     # nomes das variáveis, sem valores
├── package.json  package-lock.json  tsconfig.json  biome.json
├── automations/     # workflows n8n exportados (JSON), uma pasta por automação
├── infra/           # ambientes Docker; n8n local em infra/n8n/
├── integrations/    # conectores reutilizáveis: WhatsApp, CRM etc.
├── services/        # APIs pequenas e webhooks
├── scripts/         # scripts auxiliares e ferramentas internas
├── clients/         # configuração por cliente (sem secrets)
├── tests/           # testes e fixtures (somente dados fictícios)
└── docs/
    ├── arquitetura/
    └── comercial/   # propostas e vendas; agentes não leem por padrão
```

Estrutura base criada em T003 (D010). Cada pasta de primeiro nível e as subpastas
de `docs/` têm um `README.md` curto: propósito, como rodar ou usar, como testar ou validar.
Mudança de estrutura → registrar em `DECISIONS.md` e atualizar esta seção.

## 4. Regras de desenvolvimento

- Uma tarefa = um agente. Não usar os dois agentes na mesma tarefa.
- Fazer só o que a tarefa pede. Melhoria fora do escopo vira tarefa nova no Backlog, não código.
- Reutilizar o que existe antes de criar abstração nova.
- Nada específico de cliente em `integrations/` ou `services/`: diferenças ficam em `clients/<cliente>/`.
- Não adicionar dependência sem necessidade; justificar no commit (e em `DECISIONS.md` se for estrutural).
- Não mexer em arquivos de tarefa em andamento do outro agente.
- Dúvida que muda escopo ou arquitetura: parar e perguntar ao usuário.
- O usuário tem experiência básica com terminal, Git e servidores: antes de pedir que ele rode
  um comando, explicar o que o comando faz. Preferir sempre a configuração mais simples.

## 5. Padrões

**Código**
- Nomes no código em inglês; documentação e commits em português.
- Funções pequenas, nomes descritivos, sem código morto ou comentado.
- Validar todo payload externo na entrada (webhook, WhatsApp, CRM) antes de usar.
- Nunca engolir erro em silêncio: logar com contexto, sem dados pessoais.
- Workflows n8n: exportar o JSON para `automations/<nome>/` após cada alteração.

**Secrets e dados pessoais**
- Nunca commitar secrets: tokens, API keys, senhas, credenciais do n8n, URLs de webhook com token.
- Valores ficam em `.env` (no `.gitignore`). `.env.example` lista só nomes, com uma linha de descrição.
- Variável nova → adicionar em `.env.example` na mesma tarefa.
- Antes de commitar JSON do n8n, conferir que não há credencial ou token embutido.
- Dados de leads e clientes são dados pessoais (LGPD): nunca usar dados reais em testes, fixtures, logs ou exemplos.
- Não logar payload completo com telefone, e-mail, CPF etc.
- Clientes da área de saúde: dado de saúde é sensível (LGPD). Automações coletam só o necessário
  para qualificar e agendar (ex.: tratamento de interesse, horário), nunca histórico clínico.
- Secret encontrado no histórico do Git: parar e avisar o usuário. Não reescrever histórico por conta própria.

**Testes**
- Mudança de comportamento vem com teste automatizado, quando viável.
- Rodar os testes relacionados antes de concluir; a suíte completa antes de merge em `dev`.
- Workflows n8n: payload de exemplo em `tests/fixtures/` + passos de verificação no README da automação.
- Não desativar, apagar ou afrouxar teste para fazê-lo passar.
- Não marcar tarefa como concluída com teste falhando. Se não foi possível testar, dizer isso no relato e no handoff.

## 6. Escolher uma tarefa

1. Se há tarefa sua em "Em andamento" (sessão anterior interrompida), continue nela.
2. Senão, pegar no Backlog, de cima para baixo, a primeira que:
   - tenha `Sugerido:` igual a você, ou nenhuma sugestão;
   - tenha todas as dependências em "Concluído".
   `Sugerido:` é preferência: o agente mais adequado pode assumir se o outro não estiver nela.
3. Nunca pegar tarefa em andamento marcada para o outro agente.
4. Antes de escrever código: mover para "Em andamento" com `[CLAUDE]` ou `[CODEX]`.
   Se os agentes trabalham em cópias diferentes do repo (ex.: Codex na nuvem), commitar e dar push dessa mudança em `dev` antes de começar.
5. Tarefa grande demais para uma sessão → dividir no Backlog em tarefas novas com IDs e dependências.
6. Nenhuma tarefa adequada → parar e avisar. Não inventar trabalho.

## 7. Concluir uma tarefa

1. Testes passando (seção 5).
2. Documentação atualizada, se necessário (seção 8).
3. Em `TASKS.md`: mover para "Concluído", marcar `[x]`, remover a tag do agente.
4. Se outro agente continua: escrever handoff na seção "Handoffs" de `TASKS.md`.
5. Commit final da tarefa.
6. Relatar ao usuário em poucas linhas: o que foi feito, como testar, pendências.

## 8. Quando atualizar documentação

Na mesma tarefa, quando:
- criar/alterar automação, integração ou endpoint → README da pasta;
- nova variável de ambiente → `.env.example`;
- nova pasta ou mudança de estrutura → seção 3 deste arquivo;
- decisão técnica → `DECISIONS.md`;
- mudança nas regras de trabalho dos agentes → este arquivo.

Não criar documento novo sem necessidade. Documentação curta: o que é, como usar, como testar.

## 9. Decisões técnicas

Registrar em `DECISIONS.md` quando a escolha afeta mais de uma área, é difícil de reverter,
ou alguém perguntaria depois "por que foi feito assim?".
Ex.: ferramenta ou biblioteca, estrutura de pastas, padrão de integração, modelo de dados de cliente.
Formato no próprio arquivo. Nunca editar decisão aceita: criar uma nova que a substitui.

## 10. Git

- `main`: estável. `dev`: integração.
- Mudança significativa → branch a partir de `dev`: `feature/T031-lead-qualification`, `fix/T044-webhook-error`.
- Mudança pequena (doc, ajuste trivial) pode ir direto em `dev`.
- Commits pequenos, uma coisa por commit, com ID da tarefa: `feat(T031): cria webhook de entrada de leads`.
  Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.
- Nunca commitar direto em `main`. Merge em `main` só com autorização do usuário.
- Sem pedir ao usuário, nunca: `push --force` em `main`/`dev`, reescrever histórico, apagar branch alheia.
