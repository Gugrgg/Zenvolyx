# Anthropic interpret

Sub-workflow `aiAnthropic00001`, chamado via Execute Workflow 1.2, fonte Database,
modo Run once for each item. Implementa [interpret](../README.md) conforme D019/D026.

## Funcionamento

Valida a entrada e envia somente nome/base do negócio, pergunta atual e mensagem para
`POST https://api.anthropic.com/v1/messages`. IDs do lead, telefone, histórico e campos
extras do chamador não entram no corpo enviado. Uma mensagem livre pode conter dados
pessoais: o chamador continua responsável pela minimização prevista na D013.

O modelo, esforço, limite de saída e esquema ficam em [config.ts](config.ts).
As regras administrativas e de saúde ficam em [instructions.md](instructions.md).
Os dois são embutidos no nó **Prepare request**; o teste confere a igualdade para evitar
divergência. A avaliação da T025 deve ler esses mesmos arquivos. Ao alterá-los, atualizar
o nó, exportar o workflow e testar a igualdade novamente.

O esquema é fixo, sem opções de cliente no enum. Instruções e base formam o prefixo;
o último bloco de sistema tem `cache_control: { "type": "ephemeral" }` (5 minutos).
Pergunta e mensagem vão no conteúdo do usuário. O cache depende do prefixo idêntico e
do mínimo de tokens do provedor; a marcação não garante acerto de cache em cada chamada.

O conector aceita somente `end_turn` com um bloco de texto JSON válido, mesmo que haja
blocos de pensamento antes. `refusal` vira recusa; `max_tokens` e outros motivos de parada
viram `invalid_output`. Confere os campos, intenção, opção existente, tipo da resposta e
`reply` de até 400 caracteres. Em `urgent` e `stop`, devolve `answer` e `reply` como `null`.
A conversa envia o texto fixo da config e interrompe o atendimento automático (T028).

Limites de entrada: mensagem até 8.000 caracteres; nome do negócio até 200; base até 6.000
somando `topic` e `text`; pergunta até 1.000; IDs até 100; escolha com 1 a 10 opções únicas
e rótulos até 20 posições UTF-16, como no validador de clientes. Resposta `text`: até 1.000
caracteres. Os demais limites de texto contam caracteres Unicode. Entradas inválidas
falham antes da chamada à API; campos extras são descartados, não viram parâmetros da API.

## Falhas e privacidade

- `invalid_input`: contrato de entrada inválido, com `field`, sem repetir.
- `invalid_output`: resposta incompleta, fora do esquema ou incoerente com a pergunta, sem repetir.
- `refusal`: recusa explícita, sem repetir.
- `auth`: chave recusada, sem permissão ou credencial ausente, sem repetir.
- `provider_error`: outra falha de requisição/configuração, sem repetir.
- `unavailable`: timeout, HTTP 408/429/5xx ou falha de transporte; uma nova tentativa após
  2 segundos. Timeout por chamada: 45 segundos. Após a tentativa, preserva `retryable: true`.

O nó **Result** registra somente `ai_interpret`, `clientId`, duração e intenção ou código.
Não registra texto, resposta, raciocínio nem erro bruto do provedor. O workflow desliga
persistência de execuções bem-sucedidas, com erro e manuais. O chamador deve adotar os
mesmos cuidados: estas opções não apagam dados que um workflow pai tenha guardado.
Validação estrutural e instruções não substituem a conferência das respostas reais.

## Credencial e publicação

1. O dono cria a chave no [Console da Anthropic](https://platform.claude.com/), com saldo
   e limite de gasto definido. Uso da API é cobrado; a assinatura do aplicativo Claude
   não deve ser tratada como credencial de API.
2. No n8n local, criar credencial do tipo **Anthropic**, nome **Anthropic Zenvolyx**.
   Colar a chave só no campo **API Key**, manter Base URL padrão e testar a conexão.
3. Importar o workflow com os comandos abaixo. No editor, selecionar essa credencial
   nos nós **Call Anthropic** e **Call Anthropic (retry)**, salvar e publicar.

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml cp integrations/ai/anthropic/workflow.json n8n:/tmp/anthropic.json
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n import:workflow --input=/tmp/anthropic.json
```

Publicar pelo editor também após reimportar uma alteração, conferindo a versão publicada.
No ensaio com n8n 2.40.5, reimportar e publicar pela CLI manteve a versão anterior em
execução; a indicação de ativo por si só não confirmou a atualização.

A credencial fica na instância, nunca no export versionado. Após alterações, exportar e
limpar conforme D022: só `id`, `name`, `nodes`, `connections`, `settings` e `active`, sem
`credentials` nos nós. Nenhuma nova dependência ou variável de ambiente é necessária.

## Testar

`npm test -- tests/ai-anthropic.test.ts` avalia o código dos nós com dados fictícios, sem
rede e sem custo. A suíte cobre contrato, isolamento do corpo, cache estável, blocos de
pensamento, respostas inválidas, prioridade de urgência/parada, falhas e logs.

No n8n, criar um workflow temporário: Manual Trigger → Code devolvendo o conteúdo de
[input.json](../../../tests/fixtures/ai/input.json) → Execute Workflow `aiAnthropic00001`.
Esperado: `answer: "cleaning"` e endereço da base em `reply`, sem dados inventados.
Usar somente dados fictícios; desativar gravação das execuções também nesse workflow.

Para a conferência manual obrigatória da T024, repetir o mesmo pedido trocando `message`
pelos cinco casos de [demo-cases.json](../../../tests/fixtures/ai/demo-cases.json).
O campo `review` descreve o que conferir, não vai à API. A base fictícia da fixture serve
apenas ao ensaio; não substitui a base administrativa da clínica (T038). Conferir cada
resposta conforme os [cenários 3, 7, 8, 9 e 11](../../../docs/arquitetura/demo-cenarios.md),
registrar o resultado no `TASKS.md` e apagar o workflow temporário depois.
Uma rodada faz cinco chamadas, mais eventuais novas tentativas por falha transitória.

Referências oficiais: [saída estruturada](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
[Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5),
[cache](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
