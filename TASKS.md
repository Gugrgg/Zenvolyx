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

- [ ] T038 Criar a base administrativa da clínica fictícia (seção `ai` de `clients/odontologia-demo/`): endereço, funcionamento, tratamentos, formas de pagamento, como é a avaliação e política de preços, sem preço de tratamento nem tom de oferta
  Depende: T037 | Sugerido: CLAUDE | Ref: clients/odontologia-demo/README.md, docs/arquitetura/ia.md (Regras de saúde)
- [ ] T040 Criar os horários fictícios da demo: `calendar` e `scheduling` da clínica, agenda de demonstração com compromissos fictícios e passo a passo para ocupar um horário ao vivo (cenário 4)
  Depende: T022, T037 | Sugerido: CLAUDE | Ref: clients/odontologia-demo/README.md, docs/arquitetura/demo-cenarios.md
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
- [ ] T044 Definir e implementar proteção para reservas simultâneas de leads diferentes no mesmo horário, incluindo a política para edições humanas da agenda
  Depende: T022, T029 | Sugerido: CLAUDE | Ref: integrations/calendar/google-calendar/README.md (Limites)
- [ ] T026 Escolher o serviço de transcrição de áudio (custo, LGPD e integração)
  Depende: T011 | Sugerido: CLAUDE | Ref: docs/arquitetura/ia.md (Áudio)
- [ ] T031 Criar `npm run clean:workflow`, que limpa o export da CLI do n8n conforme a D022, e fazer o `check:workflows` recusar campos da instância (`shared`, versões e datas); até lá, limpar o export à mão
  Depende: T016 | Sugerido: CODEX | Ref: DECISIONS.md (D022), scripts/README.md
- [ ] T045 Conferir e corrigir o procedimento de publicação por CLI no n8n 2.40.5: validar a versão realmente executada depois de reimportar e publicar
  Sugerido: CODEX | Ref: integrations/ai/anthropic/README.md (Credencial e publicação)
  Evidência adicional T029 (2026-10-08): em instância descartável, reimportar o mesmo ID e publicar com --versionId ainda executou o código anterior; informar versionId novo na importação não criou a versão no histórico e a publicação foi recusada. Manter publicação pelo editor.

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
  Depende: B011, B015 | Apoio: CLAUDE e CODEX | Ref: automations/whatsapp-inbound/README.md (Limites conhecidos: eco da coexistência)
- [ ] B013 Medir os resultados do primeiro mês: contatos, avaliações agendadas, tempo de resposta e comparecimento
  Depende: B012
- [ ] B014 Criar o primeiro case, com autorização da clínica
  Depende: B013
- [ ] B015 Preparar a Zenvolyx na Meta para clientes reais: verificação da empresa e site com política de privacidade já; revisão do app com vídeos da demo depois da T030
  Depende: B001 | Apoio: CLAUDE | Ref: docs/arquitetura/whatsapp-cadastro.md (Pré-requisitos)

## Em andamento

Nenhuma.

## Concluído

- [x] T029 Acrescentar o agendamento à conversa: lista de horários, marcação, horário ocupado (`messages.slotTaken`), confirmação e CRM `scheduled`
  Ref: automations/lead-conversation/README.md; tests/conversation-scheduling.test.ts
  Validação: 600 testes (38 novos), lint, tipos, 11 workflows e 3 configs passaram. No n8n descartável: 12 cenários/48 requisições de agendamento, mais regressão da T028. Nenhuma API externa chamada.
  Publicação: leadConversation publicado pelo editor em 2026-10-08; export --published confirmou os 82 nós, conexões e configurações iguais ao código testado. Export limpo, sem credenciais. Clínica inativa e IA desligada; configuração da demo e acessos reais seguem na T038/T040/T030.

- [x] T028 Criar a conversa com perguntas, IA administrativa, qualificação, CRM, equipe, urgência e parada, com estado por lead e limpeza de 30 dias
  Ref: automations/lead-conversation/README.md, clients/README.md, DECISIONS.md (D031)
  Validação: 562 testes (48 da conversa), lint, tipos, 11 workflows e 3 configs passaram. No n8n 2.40.5 descartável: 16 requisições funcionais e 8 de concorrência/autorização/pausa, com tabelas reais e conectores simulados; limpeza removeu registro de 40 dias e preservou o recente. Nenhuma API externa chamada.
  Publicação: leadConversation e waInboundWebhook publicados pelo editor, versões ativas conferidas e exports sem credenciais. Execute Workflow confirmou a conversa publicada; verificador temporário arquivado. Config versão 3 exige ai.dataMode synthetic e ai.enabled para Gemini; clínica permanece inativa e IA desligada até T038. Agendamento segue na T029 e ensaio pelo celular na T030.

- [x] T024 Criar o conector de IA com saída estruturada, validação, regras de saúde e intenção urgent; Gemini gratuito na demo fictícia (D030), preservando Anthropic
  Ref: integrations/ai/README.md, integrations/ai/gemini/README.md, docs/arquitetura/ia.md, DECISIONS.md (D019, D026, D030)
  Validação: 510 testes (87 Gemini), lint, tipos, 10 workflows e 3 configs passaram. Os cinco cenários reais (3, 7, 8, 9 e 11) passaram com o prompt final em 2026-09-30: política de preço com convite à avaliação; urgência sem texto gerado; ausência de informação encaminhada à equipe; manipulação recusada; dúvida clínica sem diagnóstico/remédio.
  Publicação: aiGeminiDemo0001 publicado pelo editor; export sem credenciais, com versão ativa igual à validada. Execute Workflow confirmou bloqueio sem dataMode e resposta cleaning/endereço com fixture fictícia. Workflow temporário arquivado. Nenhum faturamento ativado ou chamada paga; Anthropic permanece preservado, com validação real paga adiada.

- [x] T039 Guardrails odontológicos na config: mensagens fixas `urgent` e `slotTaken` obrigatórias, com versão 2 do formato, configs, fixtures, testes e README atualizados
  Ref: clients/README.md, clients/odontologia-demo/README.md, docs/arquitetura/ia.md (Urgência)
  Validação: 351 testes, lint, tipos, check:clients (3 configs) e check:workflows passaram. Texto da clínica fictícia encaminha à equipe e orienta pronto-socorro ou 192 nos casos graves; o dono revisa antes de ativar.

- [x] T022 Criar o roteador de agenda e o conector Google Calendar: horários por fuso/expediente/ocupação, rechecagem antes da reserva e novas tentativas sem duplicar o mesmo pedido
  Validação: 348 testes passando (52 de agenda), lint, tipos, check:workflows e check:clients; 15 cenários no n8n 2.40.5 com API simulada, incluindo horário tomado, 429/503, resposta perdida e HTTP 409. Dois fluxos publicados no n8n local; teste com conta e agenda Google reais fica para T040/T030.

<!-- Manter só as ~20 mais recentes. Mais antigas: mover para docs/tasks-arquivo.md. -->

- [x] T021 Criar o roteador `integrations/crm/router/` e o conector `integrations/crm/google-sheets/` (upsertLead pelo BSUID, com busca pelo telefone e as etapas `urgent` e `stopped`), com planilha modelo e passo a passo da conta de serviço do Google
  Ref: integrations/crm/README.md, integrations/crm/router/README.md, integrations/crm/google-sheets/README.md, DECISIONS.md (D029)
  Validação: no n8n 2.40.5 local, com o conector apontando para uma API do Google Sheets simulada dentro do container, um workflow temporário chamou o roteador com 14 casos, todos com o resultado esperado: cabeçalho criado em aba vazia, atualização pelo ID, lead com BSUID novo achado pelo telefone e com o ID trocado, linha acrescentada, nome começando com `=` gravado como texto (`RAW`), só a linha certa atualizada numa planilha preenchida, datas no fuso de São Paulo; `forbidden`, `not_found` (planilha e aba), `invalid_input` e `unknown_provider`; `unavailable` e `rate_limited` depois da nova tentativa, e limite resolvido na nova tentativa. Contra o Google de verdade, uma chave descartável foi recusada (`invalid_grant`) e a credencial com `PREENCHER` falhou ao assinar: as duas viraram `auth`. Logs sem dados pessoais. `npm test` (296 testes, 68 novos), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram. Gravação real pendente da conta de serviço e da planilha da demo (T030).

- [x] T020 No fluxo de entrada, agrupar rajadas e pausar a automação por lead (eco da equipe, `handoff`, urgência e pedido para parar)
  Ref: automations/whatsapp-inbound/README.md, DECISIONS.md (D028)
  Validação: no n8n 2.40.5 local, com credencial e cliente fictícios temporários, requisições assinadas simularam a Meta: mensagem única respondida depois de 8 s; rajada de duas mensagens com 1,5 s de intervalo virou um evento só ("Oi" e "Queria marcar uma avaliação", um por linha) e a execução mais antiga parou; rajada com botão (`reply`, com o último `replyId`) e com áudio (`unsupported`); lote do mesmo lead num evento; eco com BSUID e eco só com telefone pausaram o lead (sem resposta, log `whatsapp_paused_lead`) sem afetar outro lead; eco durante a espera cancelou a rajada; segundo eco atualizou a mesma linha; pausa vencida não bloqueou e saiu na limpeza diária; tabela de rajadas vazia depois de cada caso. `npm test` (228 testes, 19 novos), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram. A pausa por eco real depende de cliente em coexistência (B012).

- [x] T019 Criar o fluxo `automations/whatsapp-inbound/`: verificação do webhook, 200 imediato, assinatura, deduplicação, status `failed`, cliente e lead identificados; README com o passo a passo para ligar o app de teste da Meta ao túnel
  Ref: automations/whatsapp-inbound/README.md, DECISIONS.md (D027)
  Validação: no n8n 2.40.5 local, com credencial e cliente fictícios temporários, 20 casos simulando a Meta deram o resultado esperado: desafio aceito (200 com o `hub.challenge`) e recusado (403) com token errado ou ausente; texto com acentos escapados e sem escapar; duplicata descartada; assinatura errada e ausente recusadas; botão, lista, usuário sem telefone e áudio (`unsupported`); status `failed`, histórico, número desconhecido e corpo que não é da Meta só no log; lote com duas mensagens; gatilho manual com o verify token certo; Data table criada na primeira mensagem e limpeza por data. Logs sem telefone, BSUID, nome nem texto. `npm test` (209 testes, 31 novos), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram. Ligação com o app real da Meta pendente: o dono cria o app e cola o App Secret (README).

- [x] T036 Repriorizar o projeto para a demo odontológica e o primeiro cliente pagante: objetivo, caminho da demo, fase comercial, dependências, regras de saúde e cenários
  Ref: TASKS.md (Objetivo atual), DECISIONS.md (D025, D026), docs/arquitetura/demo.md, docs/arquitetura/demo-cenarios.md, docs/arquitetura/ia.md (Regras de saúde)
  Validação: dependências conferidas por script temporário: nenhuma tarefa do caminho da demo depende de "depois da demo" ou da fase comercial, e não há ciclo, ID repetido nem tarefa antes da própria dependência. Regra de publicidade odontológica (art. 44, I) conferida no site do CRO-SC em 2026-09. `npm test` (178 testes), `npm run lint`, `npm run typecheck`, `npm run check:workflows` e `npm run check:clients` passaram; 42 links locais válidos.

- [x] T037 Criar o cliente fictício `clients/odontologia-demo/` (Clínica Sorriso Demo): tratamentos, pergunta de primeira consulta, regra de novos pacientes e mensagens, com config inativa e README
  Ref: clients/odontologia-demo/README.md, docs/arquitetura/demo.md
  Validação: `npm run check:clients` (3 configs) e `npm test` passaram. A config fica inativa, com `PREENCHER` nos IDs, até a T030; base da IA, mensagens novas e agenda entram nas T038, T039 e T040.

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

### Handoff T029
Concluído:
- Agendamento em conversation.js/resolveCalendar e workflow leadConversation: opções guardadas, reserva pelo intervalo, serviço da config, CRM scheduled, confirmação, slot_taken, noSlots e encaminhamento. IDs incluem início/fim, nunca índice de lista.
- Texto livre não reserva; cliques isolados recuperam somente opções guardadas. Rajada com texto adicional passa pela IA e mantém prioridade de urgent/stop/human. Falha de envio preserva appointment. Pausa recebida durante book suprime confirmação, mas conserva reserva no estado e CRM.
- 600 testes passaram, incluindo 38 de agendamento; lint, tipos, 11 workflows e 3 configs passaram. 48 requisições/12 cenários no n8n descartável mais regressão T028 passaram; nenhuma API real chamada. Instância de teste removida.
- Publicado pelo editor local em 2026-10-08; conteúdo do export --published conferido contra o código testado. Export sem credenciais.
Arquivos principais:
- automations/lead-conversation/README.md, conversation.js, conversation.d.ts, workflow.json
- tests/conversation-scheduling.test.ts; tests/lead-conversation.test.ts
- tests/fixtures/conversation/scheduling.json; tests/fixtures/conversation/input.json
Próxima tarefa: T041
Observações:
- Automatizar os cenários de docs/arquitetura/demo-cenarios.md com IA, CRM e agenda simulados. Aproveitar núcleo puro e fixtures existentes; testes já conferem que o JS embutido corresponde ao arquivo fonte. N8n Code usa cópia JSON, pois structuredClone não está disponível neste ambiente.
- lead_conversation_turns ordena rajadas do mesmo lead; espera até 10 min e libera a reserva nas saídas tratadas. Reserva interrompida expira após 30 min; reinício pode perder mensagens em processamento. Concorrência entre leads distintos permanece T044; remarcação/cancelamento, T043.
- CRM crmUpsertRouter1, WhatsApp whatsappCloudApi, IA aiGeminiDemo0001 e agenda calendarRouter01 via Execute Workflow/Database/each. Não enviar texto bruto ao CRM nem datas inventadas pela IA à agenda. Logs sem dados pessoais; avisos à equipe seguem T027.
- T038/T040 pendentes: clínica inativa e IA desligada. Gemini apenas com ai.enabled e dataMode synthetic, usando mensagens inteiramente fictícias; synthetic não anonimiza dados nem comprova plano gratuito. Sem fallback pago.
- Publicar pelo editor após reimportar (T045); conferir conteúdo com export:workflow --published, não apenas IDs de versão. CLI com N8N_RUNNERS_BROKER_PORT=5690; ensaiar tabelas por webhook/Execute Workflow.
- Scripts de ensaio em %TEMP%/zenvolyx-t029/: runtime.mjs, verify.mjs e pause.mjs criam conectores fictícios; não importar essas variantes na instância principal. Regressão anterior em %TEMP%/zenvolyx-t028/.
- Permissões reais do CRM/agenda e envio pelo número Meta permanecem para T030. Testes simulados não substituem essa validação.

### Handoff T022
Concluído:
- `calendarRouter01`: valida `listSlots`/`book`, calcula horários e repete uma vez as falhas transitórias; `googleCalendar01`: consulta ocupação e cria eventos pela conta de serviço (D018/D029).
- Cálculo puro em `slots.js`, embutido no Code node e conferido por teste; fixtures de almoço, ocupação, antecedência e horário tomado. IDs estáveis recuperam reservas após resposta perdida ou HTTP 409, conferindo identidade e intervalo.
- Fluxos importados, publicados e exportados do n8n local; exports versionados sem credenciais. Os quatro nós HTTP locais usam `Google (conta de serviço)` (`googleServiceAcc`). Nenhuma chave ou escopo da credencial foi alterado.
Arquivos principais:
- integrations/calendar/router/README.md e workflow.json; integrations/calendar/router/slots.js
- integrations/calendar/google-calendar/README.md e workflow.json
- tests/calendar.test.ts; tests/fixtures/calendar/
Próxima tarefa: T040
Observações:
- T040/T030: ativar Calendar API, acrescentar o escopo `https://www.googleapis.com/auth/calendar` preservando o de Sheets e compartilhar a agenda fictícia com a conta de serviço. Seguir o README do conector; a API simulada não valida permissões reais do Google.
- Horários UTC, rótulos no fuso do cliente, limite de 10; omitir horários ambíguos/inexistentes em DST. `slot_taken` pede nova listagem; `event_conflict` exige equipe. O roteador já repetiu falhas transitórias e registrou somente código/clientId; T027 acrescenta o aviso.
- Disponibilidade e criação são chamadas separadas: concorrência entre leads diferentes ou edição humana ainda pode sobrepor eventos (T044). Repetir o mesmo pedido não cria outro evento.
- Validação no n8n: 15 cenários numa instância Docker descartável com API fictícia em loopback; nenhuma chamada ao Google nem dado real. O ambiente temporário foi removido após o teste.

### Handoff T037
Concluído:
- cliente fictício `clients/odontologia-demo/` (Clínica Sorriso Demo), inativo, com tratamentos, primeira consulta, regra de novos pacientes e mensagens
- regras de saúde (D026) e cenários da demo documentados na T036
Arquivos principais:
- clients/odontologia-demo/config.json
- docs/arquitetura/demo-cenarios.md
Próximas tarefas: T038 e T040
Observações:
- T038 e T040 (Claude) completam a config da clínica; o README dela diz o que falta em cada uma.
- A regra qualifica só `patient: new`; quem já é paciente recebe `notQualified` (cenário 12).
