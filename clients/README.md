# Clientes

O que muda de um cliente para outro fica em `clients/<id>/`. Os fluxos são os mesmos
para todos (D014 e [visão geral da arquitetura](../docs/arquitetura/visao-geral.md)).
Nada de secrets nem de dados pessoais reais aqui: tokens e chaves ficam nas credenciais
do n8n, e contrato, preços e contatos comerciais não entram nesta pasta.

## Estrutura

```
clients/
├── README.md         # este arquivo: formato e como criar um cliente
├── _template/        # modelo com dados fictícios; pastas com "_" não são clientes
└── <id>/             # id: minúsculas, números e hífen (ex.: clinica-sorriso)
    ├── config.json   # lida pelo n8n a cada mensagem
    └── README.md     # conectores, checklist de ativação e particularidades
```

## config.json (versão 1)

Em JSON, porque o n8n lê sem biblioteca extra. Chaves em inglês; textos para o lead em português.
Exemplo completo: [`_template/config.json`](_template/config.json).

| Campo | Obrigatório | Conteúdo |
|-------|-------------|----------|
| `version` | sim | Versão do formato: `1`. |
| `id` | sim | Igual ao nome da pasta. |
| `name` | sim | Nome do negócio, como aparece nas mensagens. |
| `timezone` | sim | Fuso do cliente no padrão IANA (ex.: `America/Sao_Paulo`), usado em horários e datas. |
| `active` | sim | `false` faz a entrada ignorar o cliente. Modelos (pastas com `_`) ficam sempre `false`. |
| `whatsapp.phoneNumberId` | sim | ID do número na Meta, em texto. A entrada acha o cliente por ele; não pode repetir entre clientes ativos. |
| `crm` | sim | Onde o lead é gravado: `provider` e `settings` (IDs de recursos, nunca tokens). Hoje só `google-sheets`, com `settings.spreadsheetId`; detalhes em [integrations/crm](../integrations/crm/README.md). |
| `calendar` | não | Agenda onde a automação marca: `provider` e `settings` (IDs de recursos, nunca tokens). Hoje só `google-calendar`, com `settings.calendarId`; detalhes em [integrations/calendar](../integrations/calendar/README.md). Sem `calendar`, o lead qualificado vai para a equipe. |
| `scheduling` | com `calendar` | Regras de horário: `durationMinutes`, `minNoticeHours` (antecedência mínima), `daysAhead` (até quantos dias à frente), `hours` (chaves `mon` a `sun`, cada uma com faixas `"HH:MM-HH:MM"`; dia ausente é dia fechado) e, opcional, `serviceQuestion` (pergunta `choice` cuja resposta vira o serviço do evento). |
| `qualification.questions` | sim | Perguntas, na ordem em que são feitas: `id`, `text`, `type` (`text`, `choice` ou `number`) e, em `choice`, `options` com `id` e `label`: até 10 opções, `label` com até 20 caracteres (limites de botões e listas do WhatsApp). |
| `qualification.rules` | sim | Condições para o lead ser qualificado; todas precisam valer, e lista vazia qualifica todos. Em `choice`: `{ "question": "service", "in": ["evaluation"] }`. Em `number`: `min` e/ou `max`. Pergunta `text` não entra em regra. |
| `ai` | não | IA na conversa (D019): `enabled` (liga ou desliga) e `knowledge`, lista de `{ "topic", "text" }` com informações públicas do negócio que a IA pode usar para tirar dúvidas, até 6.000 caracteres no total. Sem `ai`, a conversa segue só com botões; detalhes em [integrations/ai](../integrations/ai/README.md). |
| `messages` | sim | Textos fixos: `welcome` (primeira resposta), `handoff` (ao chamar a equipe), `failure` (quando algo falha), `notQualified` (lead fora das regras), `chooseSlot` (antes da lista de horários), `noSlots` (sem horário livre), `booked` (confirmação; `{slot}` vira o horário marcado) e `stopped` (depois do pedido para parar). |

Regras do conteúdo:

- Sem secrets e sem dados pessoais: nada de token, telefone ou e-mail de pessoa. O que for
  secreto ou pessoal fica no n8n (D014).
- Perguntar só o necessário para qualificar e agendar; em saúde, nunca histórico clínico
  (AGENTS.md, seção 5).
- Mudança de formato sobe `version` e atualiza, na mesma tarefa, todas as configs, este README
  e o validador (T015).
- Seção nova (ex.: lembretes, na T023) entra pela tarefa que a decide e é documentada aqui.

## Criar um cliente

1. Copiar `_template/` para `clients/<id>/` e trocar o `id` pelo nome da pasta.
2. Preencher `config.json` e o README, com `active: false`.
3. Conceder os acessos que cada conector pede (ex.: compartilhar a planilha com a conta da
   agência), conforme o README do conector.
4. Rodar `npm run check:clients` (ou `npm test`, que também valida as configs) e testar com um lead fictício.
5. Trocar para `active: true`, fazer commit e atualizar a pasta no servidor.

## Como o n8n lê

A pasta `clients/` é montada somente leitura em `/files/clients` no container do n8n
([ambiente local](../infra/n8n/README.md), T012). O sub-workflow
[load-client-config](../automations/load-client-config/README.md) (T016) lê as configs, pega o cliente ativo com o
`phoneNumberId` da mensagem e devolve a config dele. Uma config alterada vale a partir da
mensagem seguinte, sem reiniciar o n8n.

## Validação automática

`npm run check:clients` valida todas as `clients/*/config.json`, inclusive modelos
e clientes inativos. O schema Zod da versão 1 fica em
[scripts/client-config-schema.ts](../scripts/client-config-schema.ts); o comando
termina com código 1 se houver problema, indicando arquivo e campo sem imprimir valores.

Além dos tipos e campos obrigatórios, confere:

- ID igual ao nome da pasta, sem espaços nas bordas; modelo com prefixo `_` inativo;
- IDs de WhatsApp únicos entre ativos e nenhum `PREENCHER` nos IDs de recursos de clientes ativos;
- IDs de perguntas únicos e de opções únicos dentro de cada pergunta, limites das opções
  e regras que citam perguntas/opções existentes; `number` exige `min` e/ou `max`, com `min <= max`;
- fuso IANA, agenda com regras de horário, faixas em ordem crescente e sem sobreposição
  (horários contíguos são aceitos; faixas que atravessam a meia-noite não são aceitas);
- serviço apontando para pergunta `choice`, base de IA com até 6.000 caracteres
  somando `topic` e `text`, e confirmação com `{slot}`.

Campos desconhecidos são rejeitados para detectar erros de digitação e adições fora
do formato. A validação não altera arquivos, não consulta fornecedores e não verifica
os acessos às contas. A revisão de conteúdo para evitar secrets e dados pessoais continua necessária.

`npm test -- tests/client-config.test.ts` executa os casos fictícios e a validação
das configs do repositório. A suíte completa (`npm test`) inclui essa verificação.
