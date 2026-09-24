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

## D009 Stack do código: Node.js 24 LTS com TypeScript
Data: 2026-09-23 | Status: Aceita (confirmada pelo dono na T004) | Tarefa: T002
Contexto: `services/`, `integrations/` e `scripts/` precisam de uma stack única, próxima do n8n (D006) e simples de manter.
Decisão: Node.js 24 LTS + TypeScript `strict`, pacote único na raiz com npm. O TS roda direto no Node, sem etapa de build (type stripping); `tsc --noEmit` só confere tipos. Testes com Vitest, lint e formatação com Biome, validação de payload externo com Zod, `.env` lido com `node --env-file`. Framework HTTP só quando surgir o primeiro endpoint. O n8n segue a D006.
Consequências: Mesma linguagem dos Code nodes do n8n e poucas dependências (typescript, vitest, biome, zod). Comandos-alvo da T004: `npm test`, `npm run lint`, `npm run typecheck`. Sem enums/namespaces do TS, incompatíveis com type stripping.

## D010 Estrutura base de pastas
Data: 2026-09-23 | Status: Aceita | Tarefa: T003
Contexto: A estrutura prevista na seção 3 do AGENTS.md ainda não existia no repositório.
Decisão: Materializar `automations/`, `integrations/`, `services/`, `scripts/`, `clients/`, `tests/` e `docs/`, incluindo `docs/arquitetura/` e `docs/comercial/`, com READMEs curtos de propósito, uso e validação.
Consequências: As pastas ficam versionadas com orientações iniciais. Comandos executáveis e testes ficam para T004; o desenho da arquitetura e a estrutura por cliente continuam em T005 e T006.

## D011 Fluxos no n8n, com conectores por contrato
Data: 2026-09-23 | Status: Aceita | Tarefa: T005
Contexto: A operação precisa ser simples para uma pessoa (D006), e CRM e agenda mudam de cliente para cliente (D008).
Decisão: Todo fluxo de produção roda no n8n: fluxos principais em `automations/` e conectores como sub-workflows em `integrations/<tipo>/<fornecedor>/`. Cada tipo de conector (WhatsApp, CRM, agenda) tem um contrato de entrada e saída em `integrations/<tipo>/README.md`, e os fluxos chamam o contrato, nunca o fornecedor. TypeScript (D009) fica para ferramentas do repositório e para `services/` só quando o n8n não resolver bem.
Consequências: Enquanto não houver serviço, a produção é só o container do n8n. Workflows são testados com fixtures e roteiro de verificação; ferramentas e serviços, com Vitest.

## D012 Fluxos compartilhados entre clientes
Data: 2026-09-23 | Status: Substituída por D014 | Tarefa: T005
Contexto: Uma única instância do n8n atende todos os clientes (D006), e a estrutura precisa ser reutilizável.
Decisão: Os fluxos são os mesmos para todos os clientes. A entrada identifica o cliente (ex.: pelo número de WhatsApp que recebeu a mensagem) e tudo que varia vem da config dele em `clients/<cliente>/` (formato na T006). Secrets ficam em credenciais do n8n, uma por cliente e serviço, que a config referencia pelo nome.
Consequências: Cliente novo = config + credenciais, sem copiar fluxo. Fluxo exclusivo de um cliente é exceção e exige decisão registrada.

## D013 O n8n guarda o mínimo de dados pessoais
Data: 2026-09-23 | Status: Aceita | Tarefa: T005
Contexto: Mensagens de leads são dados pessoais (LGPD), às vezes de saúde, e o n8n guarda o conteúdo de cada execução por padrão.
Decisão: O registro do lead é o CRM do cliente. O n8n guarda só o estado da conversa e os IDs de mensagens processadas, em tabelas internas, com limpeza automática. Execuções com sucesso não guardam dados; com erro, guardam por poucos dias. Alertas e logs não levam dados pessoais.
Consequências: Diagnosticar um fluxo que funcionou depende de fixtures e testes, não do histórico de execuções. A retenção é configurada no ambiente (T012).

## D014 Config de cliente em JSON e credenciais da agência
Data: 2026-09-23 | Status: Aceita | Tarefa: T006
Contexto: Substitui a D012, que previa uma credencial do n8n por cliente citada pelo nome na config. Os nós do n8n não escolhem credencial durante a execução, então isso obrigaria a copiar fluxos por cliente.
Decisão: Os fluxos seguem os mesmos para todos os clientes. Cada cliente tem `clients/<id>/config.json` (formato no `clients/README.md`), sem secrets e sem dados pessoais, que o n8n lê de uma pasta montada somente leitura; a entrada acha o cliente ativo pelo `whatsapp.phoneNumberId`. Cada fornecedor usa, de preferência, uma credencial da agência com acesso concedido pelo cliente, e a config guarda só IDs de recursos; credencial por cliente só quando o fornecedor exigir, na forma definida pela tarefa do conector.
Consequências: Cliente novo é pasta nova mais acessos concedidos, sem copiar fluxo. Config alterada vale depois do commit e da atualização da pasta no servidor, sem reiniciar o n8n.

## D015 WhatsApp: número do cliente, agência como Tech Provider
Data: 2026-09-23 | Status: Substituída por D023 | Tarefa: T007
Contexto: A D007 definiu a Cloud API, mas não de quem é a conta. A Meta só deixa parceiros operarem contas que o cliente compartilha, e a coexistência (app WhatsApp Business e API no mesmo número) exige que o parceiro seja Tech Provider.
Decisão: Cada cliente é dono do número e da conta (WABA) e paga as mensagens na Meta. Ele conecta o número pelo cadastro incorporado (Embedded Signup v4) com coexistência e continua usando o app. A Zenvolyx vira Tech Provider e usa uma credencial única (usuário do sistema) para todas as contas compartilhadas (D014). Desenvolvimento e demo usam o app da agência com o número de teste.
Consequências: Antes do primeiro cliente real, a agência precisa de verificação na Meta, app aprovado com acesso avançado e página de cadastro (T017). O cliente pode sair levando o número.

## D016 Entrada do WhatsApp: webhook único, BSUID, rajadas e pausa humana
Data: 2026-09-23 | Status: Aceita | Tarefa: T007
Contexto: Todos os clientes chegam pelo mesmo webhook do app; desde 2026 o telefone do lead pode vir oculto (nomes de usuário); leads mandam mensagens em sequência; e a equipe do cliente responde pelo app.
Decisão: Um webhook no n8n responde na hora, valida a assinatura, descarta repetidos e identifica o cliente (`phone_number_id`) e o lead (BSUID). Mensagens do mesmo lead são agrupadas após alguns segundos de silêncio. Mensagem da equipe pelo app (`smb_message_echoes`) ou chamada da equipe pausa a automação para aquele lead por 24 h.
Consequências: O lead é identificado pelo BSUID em todo o sistema; o telefone é opcional e só vai para o CRM. Tipos que a automação não entende (áudio, imagem) vão para a equipe até a T011.

## D017 CRM: um contrato de gravação e Google Sheets como padrão
Data: 2026-09-23 | Status: Aceita | Tarefa: T008
Contexto: A D008 pede CRM plugável, com Google Sheets ou CRM gratuito para quem não tem. Os fluxos precisam gravar o lead sem saber qual CRM o cliente usa.
Decisão: O contrato do CRM tem uma ação, `upsertLead`, que grava o estado completo do lead no primeiro contato e a cada mudança de etapa, identificando-o pelo BSUID (ou pelo telefone, se o BSUID mudou). Um sub-workflow roteador escolhe o fornecedor pelo `crm.provider` da config. O primeiro fornecedor é o Google Sheets, numa planilha do cliente compartilhada com a conta de serviço da agência (D014). Outros CRMs entram como conector novo quando um cliente precisar; se exigirem token por cliente, a forma é decidida e testada nessa tarefa, sem token na config nem nos dados da execução.
Consequências: Todo cliente tem `crm` na config; quem não tem CRM usa `google-sheets`. Gravação que falha não interrompe a conversa: gera alerta, e a próxima gravação leva o estado completo.

## D018 Agenda: horários pela config, Google Calendar como padrão
Data: 2026-09-23 | Status: Aceita | Tarefa: T010
Contexto: A demo precisa agendar. Expediente e duração variam por cliente, e a IA não pode inventar horário (visão geral da arquitetura).
Decisão: O contrato da agenda tem `listSlots` (horários livres) e `book` (marcar, conferindo antes se o horário segue livre). O roteador calcula os horários pelo expediente e pela duração da config (`timezone` e `scheduling`) menos os compromissos já na agenda; cada fornecedor só informa a ocupação e cria o evento. O primeiro fornecedor é o Google Calendar do cliente, compartilhado com a mesma conta de serviço do Sheets (D014, D017).
Consequências: `timezone` passa a ser obrigatório na config; `calendar` e `scheduling` são opcionais, e sem eles o lead qualificado vai para a equipe. O evento não tem convidados, porque conta de serviço não pode convidar, e a confirmação vai pelo WhatsApp. Lembretes e remarcação ficam para depois da demo (T023).

## D019 IA na conversa: interpreta e responde, as regras decidem
Data: 2026-09-23 | Status: Aceita | Tarefa: T011
Contexto: O dono quer IA desde a demo. Ela precisa entender texto livre sem inventar horário, preço ou qualificação, e mensagens de lead são dados pessoais, às vezes de saúde (D013).
Decisão: A IA interpreta a mensagem do lead diante da pergunta atual e responde dúvidas só com a base da config (`ai.knowledge`), sempre em saída estruturada validada; regras, horários e gravações continuam no fluxo. Provedor: API do Claude (Anthropic), pelo nó HTTP Request, com modelo inicial `claude-opus-5-5` em esforço baixo e cache de prompt. A IA recebe só nome do negócio, base, pergunta atual e mensagem: nada de telefone, nome, BSUID ou histórico.
Consequências: Custo estimado de US$ 0,04 a 0,08 por lead (docs/arquitetura/ia.md); trocar para `claude-sonnet-5`, mais rápido e mais barato, é decisão do dono depois da avaliação (T025). Áudio segue para a equipe até existir transcrição (T026). Falha, recusa ou saída inválida da IA volta para a pergunta com botões e, se repetir, para a equipe.

## D020 Estado da conversa por lead, apagado após 30 dias
Data: 2026-09-23 | Status: Aceita | Tarefa: T009
Contexto: A conversa guiada precisa lembrar a etapa, as respostas e os horários oferecidos entre uma mensagem e outra, e a D013 limita o que o n8n guarda.
Decisão: Uma tabela interna do n8n guarda, por cliente e BSUID, só etapa, índice da pergunta atual, respostas às perguntas da config, falhas seguidas, horários oferecidos, pausa, recusa e data da última interação. Um fluxo agendado apaga as linhas sem interação há 30 dias. Texto livre do lead não entra na tabela.
Consequências: Lead que volta depois de 30 dias recomeça a conversa. O histórico que importa ao cliente fica no CRM (D017).

## D021 Ambiente local em infra/n8n/
Data: 2026-09-23 | Status: Aceita | Tarefa: T012
Contexto: Materializar o ambiente já definido em D006, D013 e D014, com instruções simples para testes locais.
Decisão: Adicionar `infra/` e usar Docker Compose em `infra/n8n/`: n8n 2.40.5, SQLite no volume `n8n_data`, porta publicada apenas em `127.0.0.1`, `clients/` montada somente leitura em `/files/clients` e restrição de leitura nesse caminho. Chave, URL de webhook e fusos vêm do `.env` da raiz. Cloudflare Quick Tunnel 2026.9.1 fica em perfil opcional, ligado só durante testes após criar o login do dono.
Consequências: Sucessos, execuções manuais e progresso não são persistidos; erros ficam elegíveis para limpeza após 168 horas, com limite de 1.000 execuções. A limpeza é periódica; não elimina linhas das Data tables (limpeza da conversa fica na T028). O túnel muda de URL a cada recriação e torna a instância acessível publicamente durante o teste, sempre com login no editor. A chave e o volume precisam de backup conjunto.

## D022 Workflows com ID fixo e export limpo
Data: 2026-09-23 | Status: Aceita | Tarefa: T016
Contexto: Fluxos chamam sub-workflows pelo ID. O export da CLI do n8n traz campos da instância: projeto e dono em `shared`, versões, datas e `pinData: null`, que a T013 bloqueia.
Decisão: Cada workflow do repositório tem um `id` fixo e legível no JSON (ex.: `loadClientConfig`), mantido na importação, e quem chama usa esse ID. O JSON guardado tem só `id`, `name`, `nodes`, `connections`, `settings` e `active`. Sub-workflows ficam com `active: true` e são publicados depois de importar, porque o n8n 2.x só chama sub-workflow publicado.
Consequências: A mesma referência vale em qualquer instância, local ou de produção. Depois de editar no n8n, o export precisa ser limpo antes do commit (automatizar na T031); publicar pela CLI exige reiniciar o n8n para valer no servidor.

## D023 WhatsApp: token por cliente e porta do cliente no n8n
Data: 2026-09-24 | Status: Aceita | Tarefa: T017
Contexto: Substitui a D015. A documentação da Meta (2026-09) mostra que, no cadastro incorporado de Tech Provider, a conta do WhatsApp continua só do cliente e o acesso é por um token do cliente (business integration system user), trocado a partir de um código que vale 30 segundos; o token da própria agência não alcança essas contas.
Decisão: Continua da D015: número e conta (WABA) do cliente, que paga as mensagens; cadastro incorporado v4 com coexistência; a Zenvolyx como Tech Provider; desenvolvimento e demo com número da agência. Muda: o fluxo de cadastro troca o código pelo token do cliente e o guarda como credencial do n8n só daquele cliente; cada cliente tem uma porta, sub-workflow criado pela API do n8n que é o único lugar com essa credencial e faz as chamadas à Graph API. O conector de WhatsApp acha a porta pelo `clientId`.
Consequências: O token não aparece nos dados de execução, porque o fluxo de cadastro não salva execuções. Cadastrar clientes exige produção com domínio e HTTPS (T032), chave da API do n8n e as aprovações da Meta. A Zenvolyx segue o mesmo desenho na demo, com o token da própria agência.
