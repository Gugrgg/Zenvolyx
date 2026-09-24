# Clínica Exemplo (modelo)

Modelo com dados fictícios. Para criar um cliente, siga
[Criar um cliente](../README.md#criar-um-cliente). Este README guarda só informação técnica:
nada de contatos pessoais, contrato ou preços.

## Conectores

- CRM: _fornecedor e o que o cliente compartilhou com a agência (ex.: planilha `Leads`
  compartilhada com a conta de serviço da agência)_
- Agenda: _fornecedor e o que o cliente compartilhou com a agência_

## Ativação

- [ ] `config.json` preenchido, com `active: false`
- [ ] acessos concedidos em cada conector
- [ ] porta do WhatsApp criada e ID em `whatsapp.gatewayWorkflowId`
- [ ] `npm test` passando e teste com lead fictício
- [ ] `active: true`, commit e pasta atualizada no servidor

## Particularidades

_Nenhuma._
