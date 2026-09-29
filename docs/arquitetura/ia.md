# IA na conversa

Como a Zenvolyx usa IA nas conversas com leads (D019, D026). Contrato do conector:
[integrations/ai](../../integrations/ai/README.md). Preços e regras da Anthropic conferidos na
documentação oficial em 2026-09 (links no fim).

## O que a IA faz

- Entende o que o lead escreveu diante da pergunta atual da config: acha a opção certa em texto
  livre ("quero fazer uma limpeza" vira `cleaning`) e reconhece dúvida, pedido de atendente,
  relato de urgência e pedido para parar.
- Responde dúvidas com a base de conhecimento do cliente (`ai.knowledge`): endereço, formas de
  pagamento, serviços e o que mais o cliente aprovar. Se a resposta não está na base, diz que não
  tem a informação, sem inventar, e chama a equipe.

## O que a IA não faz

- Não decide se o lead está qualificado: quem decide são as regras da config.
- Não oferece horário: só os que vieram de `listSlots` (D018).
- Não inventa preço, disponibilidade nem promessa fora da base.
- Não pede nem repete dados de saúde e nunca faz o papel do profissional: diagnóstico,
  tratamento, remédio e urgência seguem as regras de saúde, abaixo.
- Não grava nada: o fluxo decide o que vai para o estado e para o CRM.

## Regras de saúde (D026)

A IA é um atendente administrativo e nunca faz o papel do profissional. As regras valem para todo
cliente e pesam mais nos de saúde, como clínicas odontológicas. Casos da demo:
[demo-cenarios.md](demo-cenarios.md).

A IA pode:

- informar horário de funcionamento, endereço e tratamentos oferecidos, conforme a base;
- informar as formas de pagamento que estejam na base, quando o paciente perguntar;
- explicar como funciona a avaliação, do ponto de vista administrativo (duração, o que levar,
  quem atende);
- marcar a avaliação nos horários da agenda; remarcar e cancelar, por enquanto, vão para a equipe
  (T043);
- chamar a equipe.

A IA não pode:

- diagnosticar, nem interpretar sintomas como diagnóstico ("pode ser canal");
- recomendar tratamento ou procedimento para o caso da pessoa;
- recomendar ou prescrever remédio, nem orientar cuidados em casa;
- dar orientação odontológica individual ou substituir a avaliação do profissional;
- dizer preço, prazo ou resultado que não esteja na base, nem fazer propaganda (desconto, promoção,
  gratuidade ou condição especial). O Código de Ética Odontológica proíbe publicidade com preço,
  serviço gratuito e modalidade de pagamento (art. 44, I).

Pergunta clínica sem urgência ("é cárie?", "posso tomar algum remédio?"): a IA diz que só o
dentista avalia isso, na consulta, e convida para a avaliação; a conversa segue.

### Urgência

A IA devolve `urgent` quando o paciente relata, por exemplo:

- dor intensa;
- inchaço importante no rosto, na boca ou no pescoço;
- sangramento significativo ou que não para;
- trauma: pancada, queda, dente quebrado ou que saiu do lugar;
- dificuldade para respirar ou engolir;
- outra suspeita de emergência, como febre com inchaço.

Na dúvida entre urgência e dúvida comum, vale `urgent`. O fluxo então interrompe a conversa
comercial (nada de pergunta pendente nem lista de horários), envia `messages.urgent`, grava o lead
como `urgent` no CRM, pausa a automação por 24 h e chama a equipe. A IA não escreve essa resposta:
o texto é fixo na config, revisado pela clínica, e orienta procurar um pronto-socorro ou o 192 nos
casos graves. Exemplo:

> Sinto muito que você esteja passando por isso. Vou chamar agora a nossa equipe para te atender
> com prioridade. Se tiver dificuldade para respirar ou engolir, sangramento que não para ou
> inchaço que aumenta rápido, procure agora um pronto-socorro ou ligue 192.

## Como entra na conversa

1. A entrada entrega a mensagem do lead (ou a rajada agrupada).
2. Com `ai.enabled`, o fluxo chama `interpret` com a pergunta atual.
3. Com `answer` preenchido, o fluxo registra a resposta e segue para a próxima pergunta (com
   botões) ou para as regras de qualificação.
4. `reply` preenchido vai para o lead antes da próxima pergunta.
5. `urgent` interrompe a conversa e segue as regras de urgência (D026); `human` chama a equipe;
   `stop` registra o pedido para parar (D016).
6. Falha, recusa da IA ou saída inválida: o fluxo repete a pergunta com botões; na segunda falha
   seguida, chama a equipe.

Sem `ai.enabled`, a conversa segue só com botões e listas.

## Demo gratuita (D030)

Por decisão do dono em 2026-09-29, a demo usa Gemini 3.8 Flash no nível gratuito,
com esforço LOW e dados inteiramente fictícios. O conector exige dataMode synthetic;
isso não anonimiza texto. Não conectar pacientes reais nem ativar faturamento.
Implementação e limites: [Gemini](../../integrations/ai/gemini/README.md).
A validação real da T024 passa a usar Gemini; a Anthropic segue sem chamadas pagas.
Antes do primeiro cliente real, reavaliar provedor/plano e tratamento de dados.

## Provedor e modelo (Anthropic, fora da demo gratuita)

- API do Claude (Anthropic), chamada pelo nó HTTP Request, para usar saída estruturada (resposta
  sempre no formato JSON combinado), cache de prompt e controle de esforço.
- Modelo inicial: `claude-opus-5-5`, o ponto de partida recomendado pela Anthropic, com esforço
  `low`, adequado a respostas curtas e em volume.
- Alternativa: `claude-sonnet-5`, mais rápido e com cerca de metade do custo. A troca é decisão do
  dono, depois que a avaliação (T025) mostrar que a qualidade se mantém.
- `claude-haiku-4-5` fica de fora: a aposentadoria pode acontecer a partir de 2026-10-15, e o cache
  só vale acima de 4.096 tokens.
- Instruções e base do cliente vão no início da chamada, com cache de 5 minutos: numa conversa, as
  chamadas seguintes leem do cache, que custa 10% da entrada normal.
- OpenAI e Google também serviriam, e os dois recebem áudio; o contrato do conector permite trocar
  de provedor. A escolha pesou a saída estruturada, o cache e o fato de os agentes do projeto já
  trabalharem com a Anthropic (referência oficial e ferramentas de avaliação).
- Meta Business Agent (IA da própria Meta no WhatsApp): descartado por ora. Ele responde direto ao
  lead, o que tira do fluxo o controle das regras e dos horários, e custa cerca de 4 a 5 centavos de
  dólar por mensagem, segundo a Meta.

## Custo estimado

Premissas: cerca de 8 chamadas por lead; por chamada, ~2.000 tokens fixos (instruções e base, em
cache depois da primeira), ~500 variáveis (pergunta e mensagem) e ~300 de saída.

| Modelo | Entrada / saída / leitura de cache (por milhão de tokens) | Por lead | 500 leads por mês |
|--------|-----------------------------------------------------------|----------|-------------------|
| `claude-opus-5-5` | US$ 4 / US$ 20 / US$ 0,20 | ~US$ 0,08 | ~US$ 40 |
| `claude-sonnet-5` | US$ 2 / US$ 10 / US$ 0,20 | ~US$ 0,04 | ~US$ 20 |

São estimativas: o custo real sai da avaliação e do uso. A saída pesa mais no custo, por isso
`reply` é curto.

## Dados e LGPD

- A IA recebe só o nome do negócio, a base, a pergunta atual e a mensagem do lead. Nada de
  telefone, nome, BSUID nem histórico da conversa (D013).
- Pela política comercial da Anthropic, dados da API não são usados para treinar modelos sem
  permissão e são apagados em até 30 dias, com as exceções previstas nos termos.
- O processamento é global, fora do Brasil. Restringir aos EUA (`inference_geo: "us"`) custa 1,1x e
  não evita a transferência internacional.
- A base (`ai.knowledge`) só leva informação pública do negócio, nunca dado pessoal ou de paciente.

## Áudio

A API do Claude não recebe áudio. Na demo, áudio segue para a equipe (D016). Transcrever exige um
serviço à parte, a escolher depois da demo (T026); o texto transcrito seguiria o mesmo caminho,
sem ser guardado.

## Avaliação

Casos fictícios (mensagem, pergunta atual e base, com a intenção e a resposta esperadas) rodados
contra a IA de verdade (T025), fora do `npm test`, porque cada rodada custa dinheiro. Toda troca de
modelo, esforço ou instruções passa por ela.

Até a demo, a conferência é manual (D025): os casos de saúde na T024 e todos os cenários da demo na
T030 ([demo-cenarios.md](demo-cenarios.md)). A T025 vem depois da demo, reaproveita esses cenários
e é exigida antes do primeiro cliente real.

## O que o dono precisa fazer

Na demo gratuita, manter o projeto Gemini no nível gratuito e a chave somente no n8n.
Os passos abaixo se aplicam à retomada da Anthropic, que depende de nova autorização de gasto.

- Criar a conta no Console da Anthropic, gerar a chave da API e cadastrá-la como credencial no
  n8n, nunca no repositório.
- Definir no Console um limite de gasto mensal.
- Antes do primeiro cliente real, conferir o contrato de tratamento de dados (DPA) da Anthropic à
  luz da LGPD, por causa da transferência internacional.

## Referências

- [Preços](https://platform.claude.com/docs/en/about-claude/pricing)
- [Modelos](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Saída estruturada](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Cache de prompt](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Retenção de dados da API](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
- [Meta Business Agent: preços](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)
- [Publicidade na odontologia: perguntas frequentes do CRO-SC](https://crosc.org.br/perguntas-frequentes-fiscalizacao/)
