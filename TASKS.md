# TASKS.md

Fila central de trabalho. Regras: `AGENTS.md`, seções 6 e 7.
Tarefas curtas. Detalhes ficam na documentação da área (linha `Ref:`).

## Objetivo atual

**Conseguir o primeiro cliente odontológico pagando pela Zenvolyx** (D025).

- Oferta: Sistema de Atendimento, Qualificação e Agendamento com IA para Clínicas Odontológicas.
  Promessa: "Transformamos mensagens de interessados no WhatsApp em avaliações odontológicas
  agendadas automaticamente." Foco em novos pacientes.
- Demo funcional primeiro, produção robusta depois. Até a demo ficar pronta (T030 e T042), só
  entra o que ela exige: "Backlog: caminho da demo", na ordem.
- Com a demo pronta, o desenvolvimento para e segue a "Fase comercial". O "Backlog: depois da
  demo" espera o primeiro cliente fechado (B011); a implantação dele (B012) puxa só o necessário.

Formato (linhas de baixo são opcionais):

```
- [ ] T000 Descrição curta
  Depende: T000 | Sugerido: CLAUDE ou CODEX | Ref: caminho/do/doc.md
```

Tarefas da fase comercial usam `B000`, são do dono e trazem `Apoio:` quando um agente pode ajudar.

## Backlog: caminho da demo

Em ordem. Claude e Codex trabalham em paralelo quando as dependências deixam
([tabela](docs/arquitetura/demo.md#tarefas-até-a-demo)).

- [ ] T019 Criar o fluxo `automations/whatsapp-inbound/`: verificação do webhook, 200 imediato, assinatura, deduplicação, status `failed`, cliente e lead identificados; README com o passo a passo para ligar o app de teste da Meta ao túnel
  Depende: T007, T012, T016 | Sugerido: CLAUDE | Ref: docs/arquitetura/whatsapp.md (Entrada), DECISIONS.md (D016)
- [ ] T021 Criar o roteador `integrations/crm/router/` e o conector `integrations/crm/google-sheets/` (upsertLead pelo BSUID, com busca pelo telefone e as etapas `urgent` e `stopped`), com planilha modelo e passo a passo da conta de serviço do Google
  Depende: T008, T012 | Sugerido: CLAUDE | Ref: integrations/crm/README.md, DECISIONS.md (D017)
- [ ] T022 Criar o roteador `integrations/calendar/router/` (listSlots e book, com o cálculo de horários numa função testada) e o conector `integrations/calendar/google-calendar/` (ocupação e criação de evento pela conta de serviço)
  Depende: T010, T012 | Sugerido: CODEX | Ref: integrations/calendar/README.md, DECISIONS.md (D018)
- [ ] T039 Guardrails odontológicos na config: mensagem fixa de urgência `messages.urgent` (D026) e `messages.slotTaken` (horário ocupado), com validador, testes, README e todas as configs
  Depende: T037 | Sugerido: CODEX | Ref: docs/arquitetura/ia.md (Regras de saúde), clients/README.md
- [ ] T024 Criar o conector de IA `integrations/ai/anthropic/` (ação interpret pela API do Claude, com saída estruturada, cache, validação da resposta, regras de saúde e intenção `urgent`), conferindo à mão os casos da IA nos cenários da demo
  Depende: T011, T012 | Sugerido: CODEX | Ref: integrations/ai/README.md, docs/arquitetura/ia.md, DECISIONS.md (D019, D026)
- [ ] T020 No fluxo de entrada, agrupar rajadas e pausar a automação por lead (eco da equipe, `handoff`, urgência e pedido para parar)
  Depende: T019 | Sugerido: CLAUDE | Ref: docs/arquitetura/whatsapp.md (Rajadas, Atendimento humano)
- [ ] T038 Criar a base administrativa da clínica fictícia (seção `ai` de `clients/odontologia-demo/`): endereço, funcionamento, tratamentos, formas de pagamento, como é a avaliação e política de preços, sem preço de tratamento nem tom de oferta
  Depende: T037 | Sugerido: CLAUDE | Ref: clients/odontologia-demo/README.md, docs/arquitetura/ia.md (Regras de saúde)
- [ ] T040 Criar os horários fictícios da demo: `calendar` e `scheduling` da clínica, agenda de demonstração com compromissos fictícios e passo a passo para ocupar um horário ao vivo (cenário 4)
  Depende: T022, T037 | Sugerido: CLAUDE | Ref: clients/odontologia-demo/README.md, docs/arquitetura/demo-cenarios.md
- [ ] T028 Criar o fluxo `automations/lead-conversation/`: perguntas, IA, regras, CRM, equipe, urgência e pedido para parar, com o estado em tabela (D020); erros e chamadas da equipe em log sem dados pessoais até a T027
  Depende: T016, T018, T019, T021, T024, T039 | Sugerido: CODEX | Ref: docs/arquitetura/demo.md (Roteiro da conversa), DECISIONS.md (D020, D026)
- [ ] T029 Acrescentar o agendamento à conversa: lista de horários, marcação, horário ocupado (`messages.slotTaken`), confirmação e CRM `scheduled`
  Depende: T022, T028 | Sugerido: CODEX | Ref: docs/arquitetura/demo.md (Roteiro da conversa, passo 4)
- [ ] T041 Transformar os cenários da demo em testes automáticos do fluxo, com IA, CRM e agenda simulados (fixtures em `tests/fixtures/scenarios/`)
  Depende: T029 | Sugerido: CODEX | Ref: docs/arquitetura/demo-cenarios.md
- [ ] T030 Testar a demo odontológica de ponta a ponta com o dono: todos os cenários no celular dele, com a IA de verdade, e o resultado na validação desta tarefa
  Depende: T020, T029, T038, T040, T041 | Sugerido: CLAUDE | Ref: docs/arquitetura/demo.md, docs/arquitetura/demo-cenarios.md
- [ ] T042 Escrever o roteiro de apresentação da demo para donos de clínica (cerca de 5 minutos): ordem dos cenários, o que mostrar no WhatsApp, na planilha e na agenda, e respostas para dúvidas comuns
  Depende: T030 | Sugerido: CLAUDE | Ref: docs/comercial/, docs/arquitetura/demo-cenarios.md

## Backlog: depois da demo

Só com pedido do dono (D025): espera o primeiro cliente fechado (B011). Antes de ativar o primeiro
cliente real (B012), são exigidas T025, T027 e T032, mais o cadastro do número dele (T034 e T035,
ou o mínimo que a B012 definir).

- [ ] T025 Criar a avaliação da IA (casos fictícios e `npm run eval:ai`, fora do `npm test`, com o custo de cada rodada), reaproveitando os cenários da demo
  Depende: T024 | Sugerido: CODEX | Ref: docs/arquitetura/ia.md (Avaliação)
- [ ] T027 Criar o fluxo de erro global e o sub-workflow `automations/alert/` (aviso por e-mail à agência, sem dados pessoais), ligado aos pontos que a conversa deixou em log
  Depende: T012, T029 | Sugerido: CLAUDE | Ref: docs/arquitetura/visao-geral.md (Erros), docs/arquitetura/demo.md
- [ ] T032 Especificar a produção antes do primeiro cliente real: servidor, domínio com HTTPS, backup e atualização de `clients/` e dos workflows
  Depende: T012 | Sugerido: CLAUDE | Ref: DECISIONS.md (D006, D021), docs/arquitetura/whatsapp-cadastro.md
- [ ] T035 Criar a porta do cliente automaticamente pela API do n8n (credencial, workflow a partir do modelo e publicação), para o fluxo de cadastro
  Depende: T033 | Sugerido: CODEX | Ref: docs/arquitetura/whatsapp-cadastro.md (Token e porta do cliente), DECISIONS.md (D023)
- [ ] T034 Criar o fluxo de cadastro `automations/whatsapp-onboarding/`: convite, página do cadastro incorporado v4 com coexistência, troca do código em até 30 s, porta do cliente, webhooks da conta, sincronização e aviso
  Depende: T027, T032, T035 | Sugerido: CODEX | Ref: docs/arquitetura/whatsapp-cadastro.md
- [ ] T023 Especificar o lembrete antes do horário marcado (template de utilidade, antecedência e config)
  Depende: T010 | Sugerido: CLAUDE | Ref: integrations/calendar/README.md (Depois da demo)
- [ ] T043 Remarcar e cancelar a avaliação pelo WhatsApp (hoje o pedido vai para a equipe)
  Depende: T029 | Sugerido: CLAUDE | Ref: integrations/calendar/README.md (Depois da demo)
- [ ] T026 Escolher o serviço de transcrição de áudio (custo, LGPD e integração)
  Depende: T011 | Sugerido: CLAUDE | Ref: docs/arquitetura/ia.md (Áudio)
- [ ] T031 Criar `npm run clean:workflow`, que limpa o export da CLI do n8n conforme a D022, e fazer o `check:workflows` recusar campos da instância (`shared`, versões e datas); até lá, limpar o export à mão
  Depende: T016 | Sugerido: CODEX | Ref: DECISIONS.md (D022), scripts/README.md

## Fase comercial: primeiro cliente

Do dono; marcar `[x]` aqui mesmo. Agentes só ajudam quando o dono pede, e nada aqui usa
automação: nada de raspagem de dados, disparo em massa ou contas criadas por agentes. Listas e
contatos de clínicas ficam fora do repositório (dados pessoais). B001, B002, B004 a B006 e B015
podem começar antes de a demo ficar pronta.

- [ ] B001 Definir a oferta odontológica: perfil de clínica, o que entra e o que não entra, preço de implantação e mensalidade, e condição do piloto
  Apoio: CLAUDE | Ref: docs/comercial/
- [ ] B002 Criar a apresentação curta da solução: problema, resultado, como funciona, segurança da IA e preço
  Depende: B001 | Apoio: CLAUDE
- [ ] B003 Gravar o vídeo da demo (2 a 3 minutos), seguindo o roteiro
  Depende: T042
- [ ] B004 Montar a lista inicial de 50 clínicas odontológicas, por pesquisa manual
  Depende: B001
- [ ] B005 Identificar o decisor ou gestor de cada clínica da lista
  Depende: B004
- [ ] B006 Criar a mensagem de prospecção (primeiro contato e retorno), sem prometer o que a demo não faz
  Depende: B001 | Apoio: CLAUDE
- [ ] B007 Contatar as primeiras 20 clínicas, uma a uma
  Depende: B003, B005, B006
- [ ] B008 Conseguir a primeira reunião
  Depende: B007
- [ ] B009 Fazer a discovery call: volume de contatos, como agendam hoje, agenda e CRM usados, quem responde o WhatsApp e principais dores
  Depende: B008 | Apoio: CLAUDE (roteiro de perguntas)
- [ ] B010 Enviar a primeira proposta
  Depende: B009 | Apoio: CLAUDE
- [ ] B011 Fechar o primeiro cliente: contrato assinado e primeiro pagamento
  Depende: B010
- [ ] B012 Implantar o primeiro cliente real: config, número, produção e o que mais o "Backlog: depois da demo" exigir
  Depende: B011, B015 | Apoio: CLAUDE e CODEX
- [ ] B013 Medir os resultados do primeiro mês: contatos, avaliações agendadas, tempo de resposta e comparecimento
  Depende: B012
- [ ] B014 Criar o primeiro case, com autorização da clínica
  Depende: B013
- [ ] B015 Preparar a Zenvolyx na Meta para clientes reais: verificação da empresa e site com política de privacidade já; revisão do app com vídeos da demo depois da T030
  Depende: B001 | Apoio: CLAUDE | Ref: docs/arquitetura/whatsapp-cadastro.md (Pré-requisitos)

## Em andamento

- [ ] T036 [CLAUDE] Repriorizar o projeto para a demo odontológica e o primeiro cliente pagante: objetivo, caminho da demo, fase comercial, dependências, regras de saúde e cenários
  Sugerido: CLAUDE | Ref: DECISIONS.md, docs/arquitetura/demo.md
- [ ] T037 [CLAUDE] Criar o cliente fictício `clients/odontologia-demo/`: procedimentos, pergunta de primeira consulta, regra de novos pacientes e mensagens, com config inativa e README
  Depende: T015 | Sugerido: CLAUDE | Ref: clients/README.md

## Concluído

<!-- Manter só as ~20 mais recentes. Mais antigas: mover para docs/tasks-arquivo.md. -->

- [x] T018 Criar o conector `integrations/whatsapp/cloud-api/` conforme o contrato (texto, botões, lista, template e marcar como lida, com envio pelo BSUID), chamando a Graph API pela porta do cliente
  Ref: integrations/whatsapp/cloud-api/README.md, integrations/whatsapp/README.md
  Validação: no n8n 2.40.5 local, seis casos com uma porta de teste de token fictício: texto, lista e "marcar como lida" chegaram à Meta e voltaram como `auth` (código 190); quatro botões deram `invalid_input`; porta inexistente, `no_gateway`; porta que falha de propósito, `unavailable` depois da nova tentativa. O corpo do indicador de digitação foi conferido na documentação da Meta. `npm test` (178 testes, 33 novos), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram. Envio de verdade pendente de token válido (T030).

- [x] T033 Criar a porta do cliente: modelo `integrations/whatsapp/client-gateway/` (HTTP Request para a Graph API com a credencial do cliente), ID da porta na config do cliente e passo a passo para criar a porta à mão
  Ref: integrations/whatsapp/client-gateway/README.md, DECISIONS.md (D024)
  Validação: no n8n 2.40.5 local, uma porta de teste com credencial fictícia chamou `GET /me` e recebeu 401 com erro 190 da Meta; quatro pedidos inválidos foram recusados sem sair do n8n; um ID com hífen foi importado e publicado, mas não pôde ser chamado (D024). `npm test` (145 testes, 21 novos), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram.

- [x] T017 Especificar a entrada de clientes reais no WhatsApp: verificação da empresa, app com acesso avançado (Tech Provider), página de cadastro incorporado v4 com coexistência e sincronização em 24 h
  Ref: docs/arquitetura/whatsapp-cadastro.md, DECISIONS.md (D023, que substitui a D015)
  Validação: regras da Meta conferidas na documentação oficial em 2026-09 (Tech Provider, revisão do app, cadastro incorporado v4, coexistência e tokens); `npm test` (124 testes), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram; 29 links locais e 8 da Meta válidos.

- [x] T016 Criar o sub-workflow `automations/load-client-config/`, que acha o cliente ativo pelo `phoneNumberId` e devolve a config
  Ref: automations/load-client-config/README.md, DECISIONS.md (D022)
  Validação: no n8n 2.40.5 local, importado, publicado e executado por um workflow de teste com sete casos (ativo, inativo, duplicado, modelo, número desconhecido, vazio e ausente) sobre clientes fictícios temporários, removidos em seguida; o export limpo foi reimportado pelos comandos do README. `npm test` (124 testes, 12 da T016), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram.

- [x] T015 Criar o validador das configs de clientes (schema Zod da versão 1 e teste que valida todas as `clients/*/config.json`)
  Ref: scripts/client-config-schema.ts, scripts/check-clients.ts, tests/client-config.test.ts, clients/README.md
  Implementação: Zod 4.6.5 conforme D009 e handoff T006; `npm run check:clients`, validação das relações entre campos e entre clientes ativos, fixtures fictícias válidas/inválidas e mensagens sem valores recebidos. Configs atuais preservadas e inativas.
  Validação: `npm test` (112 testes, 84 da T015), `npm run lint`, `npm run typecheck` e `npm run check:clients` (2 configs) passaram. CLI testada com sucesso, regra inválida, JSON malformado, arquivo ausente e pasta vazia/inexistente; nenhuma API externa utilizada.

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

### Handoff T016
Concluído:
- sub-workflow `loadClientConfig` em automations/load-client-config/, importado e publicado no n8n local; D022
- tests/load-client-config.test.ts roda o código do nó com clientes fictícios
Arquivos principais:
- automations/load-client-config/workflow.json
- automations/load-client-config/README.md
Próxima tarefa: T019
Observações:
- T019: chamar pelo nó Execute Workflow (fonte "Database", ID `loadClientConfig`, "Run once for each item") com `{ "phoneNumberId": <metadata.phone_number_id> }`. Com `found: false`, parar o fluxo; `found: false` ou `invalidConfigs` com itens geram aviso sem dados pessoais (T027, depois da demo; até lá, só log sem dados pessoais).
- T019: App Secret e verify token ficam no n8n ou no `.env` (nomes no `.env.example`), nunca no JSON exportado. A assinatura é calculada sobre o corpo bruto da requisição. O lead é identificado pelo BSUID (`from_user_id` / `user_id`); o telefone pode não vir.
- T019 e T020: fixtures fictícias em `tests/fixtures/whatsapp/` (texto, resposta de botão, rajada, eco da equipe, status `failed`, assinatura inválida); estado e deduplicação nas tabelas internas do n8n (D013). O número de teste da Meta não usa o app, então não gera `smb_message_echoes`: a pausa por eco da equipe só é testada com fixture.
- Até a T031 (depois da demo), limpar cada export à mão (D022): o JSON fica só com `id`, `name`, `nodes`, `connections`, `settings` e `active`. Conferir que `shared` (dono e projeto do n8n) não entrou.
- CLI do n8n dentro do container sempre com `-e N8N_RUNNERS_BROKER_PORT=5690`; importar despublica, então publicar e reiniciar o n8n depois (infra/n8n/README.md, seção 7). `n8n execute` não inicializa Data tables: testar fluxos com tabela pelo webhook.
- Docker Desktop fica em `%LOCALAPPDATA%/Programs/DockerDesktop/`; se `docker` não aparecer, usar `resources/bin/docker.exe` dessa pasta.
- O workflow de teste arquivado `t016TempHarness0` ("T016 teste temporario (pode apagar)") pode ser apagado pelo editor; a CLI não apaga.
- Os IDs reais da demo ainda precisam substituir `PREENCHER` antes de ativar a clínica da demo (`clients/odontologia-demo/`, T030); `npm run check:clients` valida antes de publicar.

### Handoff T018
Concluído:
- conector `whatsappCloudApi` em integrations/whatsapp/cloud-api/, publicado no n8n local
- contrato de WhatsApp completo: códigos de erro, limites de rótulo e nova tentativa
Arquivos principais:
- integrations/whatsapp/cloud-api/workflow.json
- integrations/whatsapp/README.md
Próxima tarefa: T028
Observações:
- T028 e T029: chamar pelo nó Execute Workflow (ID `whatsappCloudApi`, "Run once for each item"), com `clientId`, `gatewayWorkflowId` e `phoneNumberId` da config, mais os campos da ação. `auth` e `no_gateway` geram aviso à agência (T027, depois da demo; até lá, log sem dados pessoais); `outside_window` exige template.
- Envio de verdade ainda não foi testado: falta token válido e número de teste da Meta (T030). A porta da clínica da demo é criada à mão, com o token da Zenvolyx (integrations/whatsapp/client-gateway/README.md).
- T019: `history`, `smb_app_state_sync` e `account_update` chegam no mesmo webhook; confirmar e descartar (D013).
- T035 e T034: workflows que manipulam token não salvam dados de execução, nem em erro. A T034 depende da produção (T032) e das aprovações da Meta (docs/arquitetura/whatsapp-cadastro.md, Pré-requisitos).
- No n8n local ficaram, arquivados, os workflows de teste das T016, T018 e T033, além da credencial fictícia "T033 teste (pode apagar)"; podem ser apagados pelo editor.

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
- T021: etapas novas `urgent` (Urgência) e `stopped` (Pediu para parar) no contrato (T036, D026).

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
- T024: intenção `urgent`, a primeira da ordem, e as regras de saúde de docs/arquitetura/ia.md nas instruções (D026). Com `urgent`, o fluxo ignora `reply`. Conferir à mão, com a IA de verdade, os casos 3, 7, 8, 9 e 11 de docs/arquitetura/demo-cenarios.md e anotar o resultado na validação.
- T025 (depois da demo): casos em `tests/fixtures/ai/`: escolha por texto livre, dúvida respondida pela base, dúvida fora da base, pedido de atendente, "parar", urgência de saúde e tentativa de mudar as instruções. Script com o SDK oficial `@anthropic-ai/sdk` (dependência justificada no commit), `ANTHROPIC_API_KEY` no `.env` (nome no `.env.example`) e relatório com acertos e custo da rodada; roda só quando pedido.

### Handoff T009
Concluído:
- demo especificada em docs/arquitetura/demo.md; cliente `clients/zenvolyx/` (inativo); D020
- mensagens novas na config: `notQualified`, `chooseSlot`, `noSlots`, `booked`, `stopped`
Arquivos principais:
- docs/arquitetura/demo.md
- clients/zenvolyx/config.json
Próxima tarefa: T028
Observações:
- T027 (depois da demo): o sub-workflow de aviso recebe cliente, tipo (erro, equipe chamada, falha de gravação) e uma referência técnica, nunca telefone, nome ou texto; destinatário e servidor de e-mail ficam no `.env` ou em credencial do n8n (nomes no `.env.example`). O fluxo de erro global do n8n usa o mesmo sub-workflow.
- T028: conversa como máquina de estados sobre a tabela da D020, com limpeza diária das linhas sem interação há 30 dias. Pergunta com até 3 opções vai em botões; de 4 a 10, em lista (botão "Ver opções"). Gravar no CRM no primeiro contato e a cada mudança de etapa (D017). Fixtures fictícias em `tests/fixtures/conversation/` e roteiro de verificação no README.
- T028: `urgent` interrompe a conversa em qualquer etapa (D026): `messages.urgent` (T039), CRM `urgent` e pausa de 24 h; `stop` grava CRM `stopped`. Sem a T027, erros e chamadas da equipe vão para log sem dados pessoais, num ponto só, que a T027 depois troca pelo aviso.
- T029: lista com até 9 horários mais "Nenhum desses"; o `id` de cada linha aponta para o horário guardado no estado; `slot_taken` envia `messages.slotTaken` (T039) e nova lista; `{slot}` em `messages.booked` recebe o `label` do horário.
- A demo agora é a clínica fictícia (D025): testar T028 e T029 com `clients/odontologia-demo/` e os cenários de docs/arquitetura/demo-cenarios.md. Textos e regra são proposta: o dono revisa antes de ativar.
