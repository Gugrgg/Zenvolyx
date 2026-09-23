# TASKS.md

Fila central de trabalho. Regras: `AGENTS.md`, seções 6 e 7.
Tarefas curtas. Detalhes ficam na documentação da área (linha `Ref:`).

Formato (linhas de baixo são opcionais):

```
- [ ] T000 Descrição curta
  Depende: T000 | Sugerido: CLAUDE ou CODEX | Ref: caminho/do/doc.md
```

## Backlog

- [ ] T015 Criar o validador das configs de clientes (schema Zod da versão 1 e teste que valida todas as `clients/*/config.json`)
  Depende: T006 | Sugerido: CODEX | Ref: clients/README.md, DECISIONS.md (D014)
- [ ] T016 Criar o sub-workflow `automations/load-client-config/`, que acha o cliente ativo pelo `phoneNumberId` e devolve a config
  Depende: T006, T012 | Sugerido: CODEX | Ref: clients/README.md (Como o n8n lê)
- [ ] T017 Especificar a entrada de clientes reais no WhatsApp: verificação da empresa, app com acesso avançado (Tech Provider), página de cadastro incorporado v4 com coexistência e sincronização em 24 h
  Depende: T007 | Sugerido: CLAUDE | Ref: docs/arquitetura/whatsapp.md (Contas e acesso), DECISIONS.md (D015)
- [ ] T018 Criar o conector `integrations/whatsapp/cloud-api/` conforme o contrato (texto, botões, lista, template e marcar como lida, com envio pelo BSUID)
  Depende: T007, T012 | Sugerido: CODEX | Ref: integrations/whatsapp/README.md
- [ ] T019 Criar o fluxo `automations/whatsapp-inbound/`: verificação do webhook, 200 imediato, assinatura, deduplicação, status `failed`, cliente e lead identificados; README com o passo a passo para ligar o app de teste da Meta ao túnel
  Depende: T007, T012, T016 | Sugerido: CODEX | Ref: docs/arquitetura/whatsapp.md (Entrada), DECISIONS.md (D016)
- [ ] T020 No fluxo de entrada, agrupar rajadas e pausar a automação por lead (eco da equipe, `handoff`, pedido para parar)
  Depende: T019 | Sugerido: CODEX | Ref: docs/arquitetura/whatsapp.md (Rajadas, Atendimento humano)
- [ ] T021 Criar o roteador `integrations/crm/router/` e o conector `integrations/crm/google-sheets/` (upsertLead pelo BSUID, com busca pelo telefone), com planilha modelo e passo a passo da conta de serviço do Google
  Depende: T008, T012 | Sugerido: CODEX | Ref: integrations/crm/README.md, DECISIONS.md (D017)
- [ ] T022 Criar o roteador `integrations/calendar/router/` (listSlots e book, com o cálculo de horários numa função testada) e o conector `integrations/calendar/google-calendar/` (ocupação e criação de evento pela conta de serviço)
  Depende: T010, T012 | Sugerido: CODEX | Ref: integrations/calendar/README.md, DECISIONS.md (D018)
- [ ] T023 Especificar o lembrete antes do horário marcado (template de utilidade, antecedência e config), para depois da demo
  Depende: T010 | Sugerido: CLAUDE | Ref: integrations/calendar/README.md (Depois da demo)
- [ ] T024 Criar o conector de IA `integrations/ai/anthropic/` (ação interpret pela API do Claude, com saída estruturada, cache e validação da resposta)
  Depende: T011, T012 | Sugerido: CODEX | Ref: integrations/ai/README.md, docs/arquitetura/ia.md, DECISIONS.md (D019)
- [ ] T025 Criar a avaliação da IA (casos fictícios e `npm run eval:ai`, fora do `npm test`, com o custo de cada rodada)
  Depende: T024 | Sugerido: CODEX | Ref: docs/arquitetura/ia.md (Avaliação)
- [ ] T026 Escolher o serviço de transcrição de áudio (custo, LGPD e integração), para depois da demo
  Depende: T011 | Sugerido: CLAUDE | Ref: docs/arquitetura/ia.md (Áudio)
- [ ] T027 Criar o fluxo de erro global e o sub-workflow `automations/alert/` (aviso por e-mail à agência, sem dados pessoais)
  Depende: T012 | Sugerido: CODEX | Ref: docs/arquitetura/visao-geral.md (Erros), docs/arquitetura/demo.md
- [ ] T028 Criar o fluxo `automations/lead-conversation/`: perguntas, IA, regras, CRM, equipe e pedido para parar, com o estado em tabela (D020)
  Depende: T016, T018, T019, T021, T024, T027 | Sugerido: CODEX | Ref: docs/arquitetura/demo.md (Roteiro da conversa), DECISIONS.md (D020)
- [ ] T029 Acrescentar o agendamento à conversa: lista de horários, marcação, horário ocupado, confirmação e CRM `scheduled`
  Depende: T022, T028 | Sugerido: CODEX | Ref: docs/arquitetura/demo.md (Roteiro da conversa, passo 4)
- [ ] T030 Testar a demo de ponta a ponta com o dono e escrever o roteiro de apresentação
  Depende: T020, T025, T029 | Sugerido: CLAUDE | Ref: docs/arquitetura/demo.md

## Em andamento

_(vazio)_

## Concluído

<!-- Manter só as ~20 mais recentes. Mais antigas: mover para docs/tasks-arquivo.md. -->

- [x] T014 Fazer `npm run lint` passar numa cópia do repositório no Windows (arquivos com CRLF), via `.gitattributes` ou config do Biome
  Ref: .gitattributes, README.md (Desenvolvimento)
  Correção: arquivos de texto em LF no checkout, mesmo com `core.autocrlf=true`; arquivos locais verificados pelo Biome normalizados, sem mudança de conteúdo no Git. README explica como atualizar cópias antigas.
  Validação: `npm run lint`, `npm test` (28 testes) e `npm run typecheck` passaram no Windows. Checkout temporário novo com os atributos e `core.autocrlf=true` produziu os 12 arquivos JSON/TS em LF; lint passou sem normalização posterior. Pendência de CRLF registrada nas tarefas anteriores resolvida.

- [x] T013 Criar verificação automática dos workflows exportados (sem credenciais, tokens ou `pinData`) em `scripts/`, com testes
  Ref: scripts/README.md, scripts/check-workflows.ts, tests/check-workflows.test.ts
  Validação: `npm test` (28 testes), `npm run typecheck` e `npm run check:workflows` passaram; ainda não há exports reais nas pastas verificadas. Fixtures fictícias cobrem export limpo, `pinData`, tokens, credenciais, JSON inválido, CLI, referências externas e erros sem valores suspeitos.
  Lint dos arquivos da tarefa e lint completo numa cópia LF passaram. No checkout Windows, o lint completo segue falhando somente nos cinco arquivos antigos com CRLF (T014). Nenhuma dependência ou API paga adicionada.

- [x] T012 Montar o n8n local com Docker em `infra/n8n/` (versão fixa, `.env`, túnel, retenção de execuções), com passo a passo no README
  Ref: infra/n8n/README.md, DECISIONS.md (D021)
  Validação: Docker Desktop 4.92.0/Engine 29.8.0 com WSL 2; n8n 2.40.5 saudável, login criado pelo dono e API protegida; configs legíveis e somente leitura, acesso externo ao diretório recusado; Data table com linha fictícia persistiu após recriar o container; sucesso não salvo e erro retido; webhook HTTPS pelo túnel respondeu. Workflows, execuções e tabela temporários removidos; túnel desligado, URL local restaurada e n8n mantido ligado.
  Verificações: Compose, `npm test` e `npm run typecheck` passaram; lint passou na cópia LF. Correção do lint no checkout CRLF permanece na T014. `.env` preservado e fora do Git.

- [x] T009 Especificar a demo da Zenvolyx (a própria agência como cliente: lead chama no WhatsApp,
  é qualificado, agendado e registrado no CRM) e quebrar em tarefas de implementação
  Ref: docs/arquitetura/demo.md, clients/zenvolyx/, DECISIONS.md (D020)
  Validação: configs do modelo e da Zenvolyx conferidas contra todas as regras do formato (script temporário); `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia LF, já com o JSON novo; 24 links locais válidos.

- [x] T011 Definir o uso de IA na conversa (papel, provedor, custo, limites de dados, áudio e Meta Business Agent) e registrar decisão
  Ref: docs/arquitetura/ia.md, integrations/ai/README.md, DECISIONS.md (D019)
  Validação: preços, modelos, saída estruturada, cache e retenção de dados conferidos na documentação oficial em 2026-09; custo recalculado a partir das premissas; modelo com `ai` conferido por script temporário; `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia LF; 22 links locais e 6 externos válidos.

- [x] T010 Definir abordagem de agendamento (contrato do conector de agenda e primeiro fornecedor) e registrar decisão
  Ref: integrations/calendar/README.md, DECISIONS.md (D018)
  Validação: limites do Google conferidos em 2026-09 (conta de serviço não convida pessoas; o nó Google Calendar do n8n não aceita conta de serviço); modelo com fuso, agenda e expediente conferido por script temporário, com o exemplo do contrato; `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia LF; 13 links locais válidos.

- [x] T008 Definir abordagem de integração com CRM e registrar decisão
  Ref: integrations/crm/README.md, DECISIONS.md (D017)
  Validação: premissa da D014 conferida em 2026-09 (o n8n Community ainda não escolhe credencial durante a execução; resolução dinâmica só no Enterprise); modelo com `crm` conferido por script temporário; `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia LF; 12 links locais válidos.

- [x] T007 Definir abordagem de integração com WhatsApp (API oficial) e registrar decisão
  Ref: docs/arquitetura/whatsapp.md, integrations/whatsapp/README.md, DECISIONS.md (D015, D016)
  Validação: regras da Meta conferidas na documentação oficial em 2026-09 (coexistência, BSUID, preços, tokens); `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia LF; 13 links locais e 4 externos válidos.

- [x] T006 Definir estrutura reutilizável de clientes (clients/) e registrar decisão
  Ref: clients/README.md, DECISIONS.md (D014, substitui a D012)
  Validação: modelo `clients/_template/config.json` conferido contra o formato documentado (script temporário); `npm test` e `npm run typecheck` passaram; `npm run lint` passou numa cópia LF, já incluindo o JSON novo; 6 links locais válidos. Validação automática das configs fica para a T015.

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

### Handoff T012
Concluído:
- n8n local saudável, com login, Data tables e persistência testados; túnel HTTPS testado e desligado
- `.env` local preservado, ignorado pelo Git; manter a chave existente
Arquivos principais:
- infra/n8n/compose.yaml
- infra/n8n/README.md
Próxima tarefa: T016
Observações:
- Ler `/files/clients/*/config.json` pelo nó Read/Write Files from Disk; a montagem é somente leitura e esse é o diretório liberado para os nós de arquivo. Ignorar clientes inativos (D014).
- Testar Data tables pelo servidor/editor ou webhook: nesta versão, `n8n execute` isolado não inicializou o módulo Data table; a execução pelo webhook funcionou. Os testes temporários da T012 foram removidos.
- Docker Desktop está em `%LOCALAPPDATA%/Programs/DockerDesktop/`; se `docker` não aparecer numa sessão antiga, reabrir o terminal ou usar `resources/bin/docker.exe` dessa pasta.

### Handoff T006
Concluído:
- formato da config de cliente (versão 1) em clients/README.md; modelo em clients/_template/
- D014 substitui a D012: nós do n8n não escolhem credencial durante a execução
Arquivos principais:
- clients/README.md
- clients/_template/config.json
- DECISIONS.md (D014)
Próxima tarefa: T015
Observações:
- T015: adicionar `zod` (previsto na D009) e justificar no commit. Schema e verificação em `scripts/`, teste em `tests/`. Além dos campos: `id` igual ao nome da pasta; pasta com `_` é modelo e fica com `active: false`; `phoneNumberId` único entre clientes ativos; ids de perguntas e de opções únicos; regra só cita pergunta e opção que existem; `min`/`max` só em pergunta `number`; pergunta `text` fora das regras; até 10 opções por pergunta e `label` com até 20 caracteres (limites do WhatsApp). `crm` é obrigatório, com `provider` `google-sheets` e `settings.spreadsheetId` em texto não vazio (T008); `timezone` obrigatório e válido (IANA); `calendar` opcional, com `provider` `google-calendar` e `settings.calendarId`; com `calendar`, `scheduling` obrigatório: `durationMinutes` e `daysAhead` inteiros positivos, `minNoticeHours` maior ou igual a zero, `hours` só com chaves `mon` a `sun` e faixas `HH:MM-HH:MM` crescentes e sem sobreposição, e `serviceQuestion` (opcional) apontando para pergunta `choice` (T010). `ai` opcional: `enabled` booleano e `knowledge` com itens `topic` e `text` não vazios, até 6.000 caracteres no total (T011). `messages` com as oito chaves (`welcome`, `handoff`, `failure`, `notQualified`, `chooseSlot`, `noSlots`, `booked` contendo `{slot}`, `stopped`); cliente inativo pode ter `PREENCHER` nos IDs (T009). Configs inválidas de exemplo em `tests/fixtures/clients/`.
- T016: ler as configs da pasta montada pela T012 (ver Handoff T005); ignorar `active: false`; sem cliente para o `phoneNumberId`, parar e alertar sem dados pessoais (D013). Fixture fictícia e roteiro de verificação no README da automação.

### Handoff T007
Concluído:
- abordagem do WhatsApp em docs/arquitetura/whatsapp.md; contrato do conector em integrations/whatsapp/README.md
- D015 (número do cliente, agência como Tech Provider, coexistência) e D016 (webhook único, BSUID, rajadas, pausa humana)
Arquivos principais:
- docs/arquitetura/whatsapp.md
- integrations/whatsapp/README.md
Próxima tarefa: T018
Observações:
- O lead é identificado pelo BSUID (`from_user_id` / `user_id`); o telefone pode não vir. Envio pelo campo `recipient`.
- T019: App Secret e verify token ficam no n8n ou no `.env` (nomes no `.env.example`), nunca no JSON exportado. A assinatura é calculada sobre o corpo bruto da requisição.
- T019 e T020: fixtures fictícias em `tests/fixtures/whatsapp/` (texto, resposta de botão, rajada, eco da equipe, status `failed`, assinatura inválida); estado e deduplicação nas tabelas internas do n8n (D013).
- O número de teste da Meta não usa o app, então não gera `smb_message_echoes`: a pausa por eco da equipe só é testada com fixture até existir cliente em coexistência (T017).

### Handoff T008
Concluído:
- contrato do CRM em integrations/crm/README.md; D017
- `crm` obrigatório na config; modelo com exemplo `google-sheets`
Arquivos principais:
- integrations/crm/README.md
- DECISIONS.md (D017)
Próxima tarefa: T021
Observações:
- T021: README com passo a passo simples para o dono criar a conta de serviço no Google Cloud (com a Sheets API ativada) e cadastrar a credencial no n8n; a chave JSON fica só no n8n. Cabeçalho da aba `Leads` num CSV modelo em `integrations/crm/google-sheets/`, para importar numa planilha nova.
- T021: fixtures fictícias em `tests/fixtures/crm/`: lead novo, atualização pelo BSUID, BSUID novo com o mesmo telefone e fornecedor desconhecido.
- T019: o evento da entrada ganhou `name` (nome do perfil do WhatsApp, opcional), que vai para o CRM (docs/arquitetura/whatsapp.md).

### Handoff T010
Concluído:
- contrato da agenda em integrations/calendar/README.md; D018
- config com `timezone` obrigatório, `calendar` e `scheduling`; o contrato do CRM recebe `timezone` e o formato de `appointment`
Arquivos principais:
- integrations/calendar/README.md
- DECISIONS.md (D018)
Próxima tarefa: T022
Observações:
- T022: cálculo de horários numa função pura em JS, testada com Vitest (fuso, expediente com intervalo, antecedência mínima, dias à frente, ocupação); o Code node do n8n usa o mesmo código, e um teste confere que os dois são iguais.
- T022: Calendar API pelo nó HTTP Request com a credencial de conta de serviço (escopo de Calendar): consulta de ocupação e criação de evento com `extendedProperties.private` (`leadId` e marca da Zenvolyx), sem `attendees`. README com passo a passo para o cliente compartilhar a agenda ("Fazer alterações nos eventos") e achar o `calendarId`.
- T022: fixtures fictícias em `tests/fixtures/calendar/`: expediente com almoço, compromisso ocupando horário, antecedência mínima e horário tomado entre `listSlots` e `book`.
- T021: o contrato do CRM agora recebe `timezone`; datas e agendamento na planilha nesse fuso.

### Handoff T011
Concluído:
- IA na conversa em docs/arquitetura/ia.md; contrato em integrations/ai/README.md; D019
- config com a seção `ai` (`enabled` e `knowledge`)
Arquivos principais:
- docs/arquitetura/ia.md
- integrations/ai/README.md
Próxima tarefa: T024
Observações:
- T024: `POST https://api.anthropic.com/v1/messages` pelo nó HTTP Request, com a credencial da Anthropic no n8n; `model` `claude-opus-5-5`; `output_config` com `effort: "low"` e `format: { "type": "json_schema", "schema": ... }` (esquema fixo, com `additionalProperties: false`); `max_tokens` com folga (ex.: 2000). Instruções e base em `system`, com `cache_control` no último bloco fixo; pergunta e mensagem na mensagem do usuário.
- T024: o Opus 5.5 não aceita desligar o raciocínio nem `tool_choice` forçado (usar a saída estruturada). Conferir `stop_reason` antes de ler a resposta: `refusal` e `max_tokens` viram falha. O esquema da API não limita tamanho nem valores: validar `answer` contra as opções e `reply` até 400 caracteres no conector.
- T024: instruções num arquivo do repositório (ex.: `integrations/ai/anthropic/instructions.md`), usado pelo sub-workflow e pela avaliação; um teste confere que o JSON exportado usa o mesmo texto e o mesmo modelo.
- T025: casos em `tests/fixtures/ai/`: escolha por texto livre, dúvida respondida pela base, dúvida fora da base, pedido de atendente, "parar", urgência de saúde e tentativa de mudar as instruções. Script com o SDK oficial `@anthropic-ai/sdk` (dependência justificada no commit), `ANTHROPIC_API_KEY` no `.env` (nome no `.env.example`) e relatório com acertos e custo da rodada; roda só quando pedido.

### Handoff T009
Concluído:
- demo especificada em docs/arquitetura/demo.md; cliente `clients/zenvolyx/` (inativo); D020
- mensagens novas na config: `notQualified`, `chooseSlot`, `noSlots`, `booked`, `stopped`
Arquivos principais:
- docs/arquitetura/demo.md
- clients/zenvolyx/config.json
Próxima tarefa: T028
Observações:
- T027: o sub-workflow de aviso recebe cliente, tipo (erro, equipe chamada, falha de gravação) e uma referência técnica, nunca telefone, nome ou texto; destinatário e servidor de e-mail ficam no `.env` ou em credencial do n8n (nomes no `.env.example`). O fluxo de erro global do n8n usa o mesmo sub-workflow.
- T028: conversa como máquina de estados sobre a tabela da D020, com limpeza diária das linhas sem interação há 30 dias. Pergunta com até 3 opções vai em botões; de 4 a 10, em lista (botão "Ver opções"). Gravar no CRM no primeiro contato e a cada mudança de etapa (D017). Fixtures fictícias em `tests/fixtures/conversation/` e roteiro de verificação no README.
- T029: lista com até 9 horários mais "Nenhum desses"; o `id` de cada linha aponta para o horário guardado no estado; `slot_taken` gera nova lista; `{slot}` em `messages.booked` recebe o `label` do horário.
- Textos, regra e base da Zenvolyx são proposta: o dono revisa antes de ativar (clients/zenvolyx/README.md).
