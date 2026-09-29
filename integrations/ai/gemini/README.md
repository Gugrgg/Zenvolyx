# Gemini interpret — demo fictícia

Sub-workflow `aiGeminiDemo0001`, Execute Workflow 1.2, Database, Run once for each item.
Implementa [interpret](../README.md) com **`dataMode: "synthetic"` obrigatório** (D030).
Esse campo confirma a origem fictícia; não anonimiza texto nem detecta todos os dados
pessoais. Não conectar este conector gratuito a conversas de pacientes reais.

## Funcionamento

Modelo e esquema em [config.ts](config.ts): `gemini-3.8-flash`, esforço `LOW`, até
4.096 tokens de saída, uma resposta. Instruções administrativas e de saúde compartilhadas
com [Anthropic](../anthropic/instructions.md), embutidas no nó Prepare request e
conferidas pelo teste. Nenhuma chamada à Anthropic é feita por este workflow.

`POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`
recebe somente business, question e message. Sem ferramentas, pesquisa, histórico,
criação de cache explícito ou alternativa paga. O prefixo fixo permite cache implícito
quando oferecido pelo provedor; não há promessa de acerto de cache ou TTL de 5 minutos.

Saída JSON validada: exatamente uma candidata com `finishReason: STOP` e um bloco de
texto final. Pensamento é descartado; bloqueio de segurança vira `refusal`, truncamento
ou formato inesperado vira `invalid_output`. `urgent` e `stop` sempre devolvem answer/reply
null, para o chamador usar mensagens fixas. Limites de entrada, validação semântica,
timeout de 45 s e uma tentativa adicional após 2 s seguem o [conector original](../anthropic/README.md).
HTTP 429 ou 5xx repetido retorna `unavailable`, sem trocar de modelo ou ativar cobrança.

Não salva execuções, inclusive manuais e com erro. Logs só com evento, clientId, duração
e intenção/código. O workflow pai também deve desativar persistência de mensagens.

## Credencial e uso gratuito

1. Criar projeto no Google AI Studio e confirmar **Nível gratuito**, sem configurar
   faturamento. Usar somente modelos com cota gratuita; a disponibilidade depende da conta.
2. No n8n, cadastrar **Google Gemini(PaLM) Api**, nome **Gemini Zenvolyx Demo**, com
   Host `https://generativelanguage.googleapis.com`. A chave fica só na credencial.
3. Importar workflow.json, selecionar essa credencial nos dois nós Call Gemini,
   salvar e publicar **pelo editor**, inclusive após reimportação (T045).
4. Após editar, exportar e limpar conforme D022: só id/name/nodes/connections/settings/active,
   sem credentials, versões, pinData ou dados de execução. Nenhuma variável de ambiente
   ou dependência nova é necessária.

O código não consegue consultar nem garantir o plano de faturamento da chave; o dono
deve manter o projeto no nível gratuito. Não habilitar faturamento quando atingir a cota.
O Google pode usar conteúdo do plano gratuito para melhorar produtos e revisão humana:
somente base, mensagens e pacientes **inteiramente fictícios**, inclusive na T030.
Uso com pacientes reais exige nova decisão de provedor/plano e avaliação de dados (D030).

## Testar

`npm test -- tests/ai-gemini.test.ts`: testes sem rede, dados fictícios e sem custo.
No n8n: Manual Trigger → Code com [input.json](../../../tests/fixtures/ai/input.json)
acrescido de `dataMode: "synthetic"` → Execute Workflow `aiGeminiDemo0001`.
Desativar persistência de execuções também no workflow temporário.

Para a T024, trocar message pelos cinco [casos da demo](../../../tests/fixtures/ai/demo-cases.json)
(3, 7, 8, 9 e 11). Conferir os critérios review manualmente; review não vai à API.
A fixture não substitui a base da T038. Rodar casos sequencialmente e respeitar a cota;
em 429 persistente, interromper o ensaio e retomar após a renovação da cota. Não declarar
o cenário validado com resposta simulada. Arquivar o workflow temporário após o ensaio.

Referências: [modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash),
[preços](https://ai.google.dev/gemini-api/docs/pricing),
[API generateContent](https://ai.google.dev/api/generate-content),
[termos e dados](https://ai.google.dev/gemini-api/terms).
