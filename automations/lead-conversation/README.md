# Conversa com leads (T028 em andamento)

Máquina de estados sobre uma Data table, com perguntas da config, regras de
qualificação, CRM, mensagens do WhatsApp e pausa de 24 horas. ID `leadConversation`.
O arquivo `conversation.js` contém as funções puras embutidas nos nós Code;
`conversation.d.ts` descreve os contratos para os testes.

**Rascunho, ainda não publicado nem ligado à entrada.** A ativação da IA aguarda a
confirmação do formato que autoriza dados fictícios na configuração do cliente.
O nó Prepare mantém `needsAI: false` enquanto essa decisão estiver pendente.
Os testes da interpretação usam respostas simuladas; não há chamadas pagas.

## Entrada e estado

Execute Workflow, fonte Database, Run once for each item. Entrada: um item
`{ event, config }`, no formato da saída **Burst event** de
[whatsapp-inbound](../whatsapp-inbound/README.md#saída). Evento e campos usados
da config são validados antes de acessar tabelas ou conectores. Config inativa
é recusada. Exemplo completo: [input.json](../../tests/fixtures/conversation/input.json).

`lead_conversations`: `clientId`, `leadId` (BSUID), `stateJson` e `lastContactAt`.
O JSON guarda etapa, índice da pergunta, respostas administrativas, falhas seguidas,
horários oferecidos, recusa, agendamento e primeiro/último contato. Não guarda
mensagem original, nome, telefone ou resposta gerada. Linhas com mais de 30 dias
sem interação são removidas diariamente às 3h20 no fuso da instância.

Estado é separado por cliente e lead. Estado inválido ou duplicado encaminha à
equipe; uma falha de leitura/gravação interrompe o envio. O fluxo confere novamente
`whatsapp_lead_pauses` antes dos efeitos, para respeitar uma pausa iniciada enquanto
a mensagem era processada. A pausa usa a tabela existente e as regras da D028.

## Comportamento

- Primeiro contato: CRM `talking`, boas-vindas e primeira pergunta. Resposta inicial
  reconhecida pela IA avança diretamente para a seguinte.
- Até três opções: botões; quatro a dez: lista com `Ver opções`. IDs incluem
  pergunta e opção (`procedure:implant`), rejeitando botões de outra pergunta.
  Uma rajada com texto adicional não é tratada como mero clique.
- Resposta válida zera as falhas. Duas falhas consecutivas encaminham à equipe.
  Número pode ser lido diretamente; texto administrativo é resumido pela IA,
  nunca copiado bruto para o estado.
- Qualificação usa todas as regras da config. CRM recebe o estado completo no
  primeiro contato e a cada mudança de etapa; falha do CRM não impede a resposta.
- `urgent` e `stop` descartam texto gerado, usam mensagens fixas e pausam por 24 h.
  `human`, mídia e falhas repetidas encaminham à equipe. Recusa fica no estado e
  no CRM. Novo contato entregue após a pausa pode recomeçar a conversa (D028).
- Sem agenda, qualificado vai para a equipe. Com agenda, permanece `qualified`
  com `readyForScheduling: true`: a T029 implementa a escolha e reserva. Nenhum
  horário é inventado ou confirmado neste fluxo.
- Falha de envio registra erro, pausa e atualiza o CRM para a equipe; urgência e
  recusa conservam suas etapas. Não tenta enviar outra mensagem no mesmo erro.

O nó **Report** concentra logs com evento, código e clientId; sem BSUID, telefone,
nome ou texto. A T027 acrescentará o aviso. Persistência de execuções, inclusive
erros e manuais, permanece desligada. A entrada também precisa desse ajuste ao
ser conectada na conclusão da T028.

## Verificação

`npm test -- tests/lead-conversation.test.ts` verifica transições, isolamento,
regras, fallback, estados encerrados e minimização de dados, sem rede.

Ensaio em n8n 2.40.5 descartável, acessível somente em loopback, com tabelas reais
e substituição dos nós Execute Workflow por respostas fictícias:

1. Enviar a fixture; conferir CRM `talking`, boas-vindas e lista.
2. Enviar `procedure:implant` e depois `patient:new`; conferir respostas persistidas,
   CRM `qualified`/`with_team`, mensagem fixa e pausa.
3. Repetir enquanto pausado: nenhum envio nem alteração do estado.
4. Em leads distintos, simular `urgent`, `stop`, `human`, falha da IA duas vezes,
   falha de CRM, markRead e envio; conferir etapas, pausas e logs.
5. Simular paciente recorrente e depois dúvida administrativa: estado permanece
   encerrado e a resposta não reabre o questionário.
6. Inserir estados fictícios com 40 dias e 1 dia; executar a limpeza e conferir
   que apenas o recente permanece.

Sem Meta, Google Sheets ou Gemini reais neste ensaio. Teste integrado pelo celular
fica na T030, com dados fictícios e os recursos configurados pelo dono.
