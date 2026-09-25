# CRM Google Sheets connector

Conector `google-sheets` do [contrato do CRM](../README.md) (D017, D029), chamado pelo
[roteador](../router/README.md). ID fixo `crmGoogleSheets1`. Grava o lead na aba `Leads` da
planilha do cliente pela API do Google Sheets, com a conta de serviço da agência (D014).

## Como funciona

1. **Prepare row**: monta a linha nas colunas A a I, na ordem e nos formatos do contrato, com as
   datas no fuso do cliente.
2. **Read sheet**: lê `Leads!A:I`.
3. **Plan write**: acha a linha do lead pelo ID (coluna I). Sem ela, procura pelo telefone
   (coluna B), porque o BSUID muda quando o lead troca de número, e grava o ID novo nessa linha.
   Sem nenhuma das duas, acrescenta uma linha; aba vazia recebe o cabeçalho junto.
4. **Write row**: atualiza a linha inteira ou acrescenta, sempre em modo `RAW`: o que o lead
   escreve entra como texto, nunca como fórmula (um nome começando com `=` não é executado).
5. **Result**: devolve `{ "ok": true }` ou a falha com o código (tabela abaixo).

## Planilha

- Aba `Leads`. As colunas A a I são da automação e são reescritas a cada gravação; anotações da
  equipe vão da coluna J em diante.
- Modelo com o cabeçalho: [leads-template.csv](leads-template.csv), para importar numa planilha
  nova. Se a aba estiver vazia, o conector grava o cabeçalho na primeira vez.
- Datas e agendamento como texto `dd/mm/aaaa hh:mm`, no fuso do cliente.

## Erros

| `code` | Quando | `retryable` |
|--------|--------|-------------|
| `auth` | O Google recusou a conta de serviço (e-mail ou chave errados na credencial). | não |
| `forbidden` | Planilha não compartilhada com a conta de serviço, ou API do Sheets desativada no projeto. | não |
| `not_found` | Planilha inexistente ou sem a aba `Leads`. | não |
| `rate_limited` | Limite de uso da API do Google. | sim |
| `unavailable` | Erro do Google (5xx) ou de rede. | sim |
| `provider_error` | Outra resposta do Google. | não |

Nas falhas temporárias, o roteador tenta de novo uma vez.

## Conta de serviço do Google (dono, uma vez)

Uma única conta de serviço da Zenvolyx atende todos os clientes (D014) e, a partir da T022, também
a agenda. Painel: [console.cloud.google.com](https://console.cloud.google.com/).

1. **Projeto.** Criar um projeto (ex.: `zenvolyx-automacao`).
2. **API.** Em APIs e serviços > Biblioteca, ativar a **Google Sheets API**.
3. **Conta de serviço.** Em IAM e administrador > Contas de serviço, criar a conta (ex.:
   `zenvolyx-n8n`), sem papéis no projeto.
4. **Chave.** Na conta criada, em Chaves > Adicionar chave > Criar nova chave > JSON. O arquivo
   baixado contém a chave privada: é um segredo.
5. **Credencial no n8n.** Abrir a credencial **Google (conta de serviço)**. No n8n local ela já
   existe, com `PREENCHER`; em outra instância, criar uma do tipo "Google Service Account API" com
   esse nome. Preencher:
   - **Service Account Email**: o `client_email` do arquivo;
   - **Private Key**: o `private_key` do arquivo, inteiro;
   - **Set up for use in HTTP Request node** ligado e, em **Scope(s)**,
     `https://www.googleapis.com/auth/spreadsheets`.
6. **Apagar o arquivo.** Depois de salvar a credencial, apagar o JSON do computador. Nunca colar a
   chave em chat, e-mail ou no repositório.

## Planilha de cada cliente

1. Na conta Google do cliente (ou da agência, se ele não tiver), criar a planilha com a aba
   `Leads` e importar o [modelo](leads-template.csv), se quiser o cabeçalho já pronto.
2. Compartilhar como **Editor** com o e-mail da conta de serviço.
3. Copiar o ID da planilha, o trecho da URL entre `/d/` e `/edit`, para
   `crm.settings.spreadsheetId` na config do cliente.

Na demo, a planilha da clínica fictícia fica na conta Google do dono.

## Importar e publicar

Na raiz do repositório, com o n8n ligado, estes comandos copiam o JSON para o container, importam
(a importação despublica), publicam e reiniciam o n8n
([comandos da CLI](../../../infra/n8n/README.md#7-comandos-da-cli-do-n8n)):

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp integrations/crm/google-sheets/workflow.json n8n:/tmp/crm-google-sheets.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/crm-google-sheets.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n publish:workflow --id=crmGoogleSheets1
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

O `publish:workflow` precisa responder "Publishing workflow with ID: crmGoogleSheets1". O JSON
não leva credenciais (D022): depois de importar, selecionar **Google (conta de serviço)** nos nós
**Read sheet** e **Write row**, salvar e publicar de novo. No n8n local isso já está feito.

## Limites

- Duas gravações ao mesmo tempo para o mesmo lead novo podem criar duas linhas. A conversa grava
  uma etapa de cada vez, então é raro.
- Cada chamada pede um token novo ao Google, porque a credencial do n8n não o guarda: são duas
  chamadas ao Google por leitura ou gravação.
- A API do Google Sheets tem limite de uso por minuto; acima dele, volta `rate_limited`.

## Como testar

- Automático: `npm test -- tests/crm-google-sheets.test.ts` roda o código dos nós deste JSON:
  formato da linha (etapas, respostas, agendamento, fuso), busca pelo ID e pelo telefone, aba
  vazia, sem cabeçalho e com linhas curtas, tradução de cada resposta do Google e o
  [modelo CSV](leads-template.csv).
- No n8n (T021): uma API do Google Sheets simulada dentro do container e um workflow temporário
  chamaram o roteador com 14 casos, todos com o resultado esperado:
  - gravações: cabeçalho numa aba vazia; atualização pelo ID; lead com BSUID novo achado pelo
    telefone, com o ID trocado; linha acrescentada; nome começando com `=` gravado como texto;
    só a linha 4 atualizada numa planilha preenchida;
  - erros: `forbidden`, `not_found` (planilha e aba), `unavailable` depois da nova tentativa,
    limite resolvido na nova tentativa, `rate_limited`, `invalid_input` e `unknown_provider`.
- Contra o Google de verdade: uma chave descartável, sem conta, foi recusada pelo Google
  (`invalid_grant`), e a credencial com `PREENCHER` falhou ao assinar. As duas viraram `auth`.
- Gravação real: depende da conta de serviço e da planilha da demo (passos acima); fica para a
  T030.
