# Calendar router

Sub-workflow `calendarRouter01`, chamado pelo Execute Workflow (fonte Database,
modo Run once for each item). Entrada e saída: [contrato](../README.md).

Valida o pedido e chama `googleCalendar01`. Em `listSlots`, calcula os horários
com `slots.js`, também embutido no nó **Calculate slots**. O teste confere que os
dois textos são iguais. Não usa o fuso da máquina nem um relógio enviado pelo chamador.

## Horários

- Blocos ancorados no início de cada faixa de expediente, sem atravessar intervalos.
- Antecedência mínima aplicada ao início; o fim deve caber na janela de consulta:
  de agora até `daysAhead × 24 h` depois. Essa janela usa tempo decorrido, inclusive em DST.
- Horários locais inexistentes ou ambíguos nas mudanças de horário de verão são
  omitidos; também são omitidos blocos cuja duração real difere da duração configurada.
- Intervalos ocupados são fechados no início e abertos no fim: terminar quando outro
  compromisso começa é permitido. Ocupação inválida gera falha, nunca agenda livre.
- Limites de entrada: `limit` de 1 a 10; duração inteira de 1 a 1.440 minutos;
  `daysAhead` inteiro de 1 a 366; antecedência de 0 a 8.784 horas; até 24 faixas por dia.

`book` recebe o horário UTC anteriormente oferecido e guardado pela conversa (T029).
Não recebe `scheduling`: valida o intervalo e consulta novamente a ocupação. O chamador
deve recuperar o horário pelo ID da opção guardada, nunca aceitar datas inventadas pela IA
ou diretamente enviadas pelo lead. Esse sub-workflow não é um webhook público.

## Falhas e nova tentativa

Faz uma única nova tentativa, após 2 segundos, para `rate_limited` e `unavailable`.
O conector usa a mesma identidade do evento nessa nova tentativa. Falhas de negócio
como `slot_taken` não são repetidas. Ao esgotar, registra apenas `calendar_failed`,
`clientId` e código; nenhuma resposta do Google, nome, telefone ou BSUID no log.

## Importar e testar

Importar e publicar primeiro o [conector](../google-calendar/README.md).
Com o n8n ligado, na raiz do repositório:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp integrations/calendar/router/workflow.json n8n:/tmp/calendar-router.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/calendar-router.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=calendarRouter01
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

`npm test -- tests/calendar.test.ts` testa horários, fuso, DST, antecedência, janela,
ocupação e validação dos nós com fixtures fictícias em `tests/fixtures/calendar/`.
O relógio dos testes é fixo; no n8n, trocar as datas de `book` por datas futuras.
