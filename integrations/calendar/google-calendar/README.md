# Google Calendar connector

Sub-workflow `googleCalendar01`, chamado pelo [roteador](../router/README.md).
Usa HTTP Request com a conta de serviço Google já usada pelo CRM (D018/D029).
O endpoint é fixo; o ID da agenda é codificado no caminho ou enviado em `items`.

## Como funciona

`listSlots` consulta `freeBusy` só para a agenda solicitada. Retorna períodos ocupados
ao roteador; erros dentro da resposta da agenda, mesmo com HTTP 200, viram falha.

`book` deriva um ID SHA-256 de cliente, agenda, lead e intervalo UTC. Consulta esse
evento antes de gravar: se já existir com a mesma identidade e horário, devolve seu ID.
Caso contrário, consulta a ocupação e só cria se continuar livre. O evento contém
apenas serviço/nome no título, telefone quando houver na descrição e a marca da
Zenvolyx; `leadId`, `clientId` e `zenvolyx` ficam nas propriedades privadas. Sem convidados.

Se a gravação tiver ocorrido mas a resposta se perder, a nova tentativa encontra o
mesmo evento. Um HTTP 409 também exige buscar e conferir o evento; não é tratado
automaticamente como sucesso. Evento cancelado, movido ou de outra identidade gera
`event_conflict`. Não alterar ou apagar eventos existentes para contornar essa falha.

## Configurar o Google e o cliente

1. Criar a conta de serviço, se necessário, conforme o [CRM](../../crm/google-sheets/README.md#conta-de-serviço-do-google-dono-uma-vez).
2. No mesmo projeto do Google Cloud, ativar **Google Calendar API**.
3. No n8n, abrir **Google (conta de serviço)** (`googleServiceAcc`), habilitada para
   HTTP Request. Acrescentar `https://www.googleapis.com/auth/calendar` em Scope(s),
   preservando `https://www.googleapis.com/auth/spreadsheets`. Não enviar a chave ao chat.
4. No Google Calendar do cliente: Configurações da agenda > Compartilhar com pessoas
   ou grupos específicos. Adicionar o e-mail da conta de serviço com **Fazer alterações
   nos eventos**. Usar uma agenda separada e fictícia para a demo.
5. Em Configurações > Integrar agenda, copiar o **ID da agenda** para
   `calendar.settings.calendarId` da config. Usar o ID explícito, não `primary`.
6. Preencher `timezone` e `scheduling`; executar `npm run check:clients` antes de ativar.

## Importar e publicar

Na raiz, com o n8n ligado, os comandos abaixo importam e publicam o conector:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp integrations/calendar/google-calendar/workflow.json n8n:/tmp/google-calendar.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/google-calendar.json
```

O export não leva credenciais. No editor, selecionar **Google (conta de serviço)**
nos quatro nós HTTP: **Find existing event**, **Read busy**, **Insert event** e
**Recover event**. Salvar, publicar e reiniciar o n8n. Pela CLI, publicar com:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=googleCalendar01
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

## Verificação

Automático: `npm test -- tests/calendar.test.ts`. No n8n com uma agenda fictícia:

1. Chamar `calendarRouter01` com a fixture `office-hours`, adaptando ID, fuso e expediente.
   Conferir lista, intervalo de almoço e antecedência.
2. Criar um compromisso ocupando um dos horários: nova listagem deve omiti-lo.
3. Escolher outro horário, ocupá-lo no Google e chamar `book` com a escolha antiga:
   deve devolver `slot_taken`, sem criar evento.
4. Reservar um horário livre. Conferir título, descrição, fuso e ausência de convidados.
   Repetir exatamente o pedido: deve voltar o mesmo `eventId`, sem segunda reserva.
5. Testar acesso recusado numa agenda fictícia não compartilhada: deve haver falha,
   sem horários inventados nem dados pessoais nos logs. Apagar só os eventos fictícios de teste.

O ensaio com credenciais e agenda reais depende da configuração acima (T040/T030).
Testes com API simulada não confirmam as permissões da conta do Google.

Na T022, 15 cenários passaram no n8n 2.40.5 numa instância temporária com API
simulada: listagem, agenda cheia, resposta inválida, acesso recusado, limite de uso,
indisponibilidade, reserva repetida, horário tomado, resposta perdida após gravar,
recuperação de HTTP 409, separação por cliente e entradas inválidas.

## Limites

Consultar disponibilidade e inserir são operações separadas. Uma reserva simultânea
de outro lead ou uma edição humana entre essas operações pode gerar sobreposição.
O ID estável protege novas tentativas do mesmo pedido; não é bloqueio global de agenda.
O tratamento dessa concorrência fica na T044, depois da demo.
Eventos marcados como disponíveis/transparentes no Google não bloqueiam `freeBusy`.
Cancelamento e remarcação ficam na T043; falhas e avisos por e-mail, na T027.

Referências: [freeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query),
[criação de eventos e IDs](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
