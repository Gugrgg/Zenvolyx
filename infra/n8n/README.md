# n8n local

n8n **2.40.5** com SQLite e Data tables, dados persistentes e configs de clientes
somente leitura em `/files/clients`. O editor abre em `http://localhost:5678/`.
O Cloudflare Tunnel **2026.9.1** é opcional, para receber webhooks durante testes.

## 1. Preparar o Docker

No Windows, instalar e abrir o [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
com backend WSL 2 e containers Linux. Se o instalador pedir para habilitar WSL ou
reiniciar o Windows, concluir isso antes de continuar. No Linux, usar Docker Engine
com o plugin Compose. Não é necessário instalar n8n nem cloudflared no computador.

Abrir um terminal PowerShell na **raiz do repositório**. Estes comandos conferem
se o servidor Docker está funcionando e se o Compose está disponível:

```powershell
docker version
docker compose version
```

`docker version` precisa mostrar **Client e Server**. Se faltar Server, abrir o
Docker Desktop e esperar o motor iniciar. Os comandos abaixo partem sempre da raiz.
Se `docker` não for encontrado após instalar, reabrir o terminal. Na instalação por
usuário, o executável fica em `%LOCALAPPDATA%/Programs/DockerDesktop/resources/bin/docker.exe`.

## 2. Criar o .env uma única vez

O bloco abaixo gera uma chave aleatória e grava o `.env` sem mostrar a chave no
terminal. Ele para se o arquivo já existir, para não trocar uma chave em uso.
Nesse caso, completar apenas as variáveis ausentes no arquivo existente.

```powershell
if (Test-Path -LiteralPath .env) { throw '.env já existe; preserve a chave atual.' }
$n8nKeyBytes = New-Object byte[] 32
$n8nRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$n8nRandom.GetBytes($n8nKeyBytes)
$n8nRandom.Dispose()
$n8nKey = [BitConverter]::ToString($n8nKeyBytes).Replace('-', '').ToLowerInvariant()
@(
  "N8N_ENCRYPTION_KEY=$n8nKey"
  'WEBHOOK_URL=http://localhost:5678/'
  'GENERIC_TIMEZONE=America/Sao_Paulo'
  'TZ=America/Sao_Paulo'
) | Set-Content -LiteralPath .env -Encoding ascii
Remove-Variable n8nKey,n8nKeyBytes
```

Em outro sistema, preencher as mesmas variáveis usando o [.env.example](../../.env.example)
e uma chave aleatória de 32 bytes. Guardar uma cópia segura da chave junto do backup:
perdê-la impede a leitura das credenciais. O `.env` é ignorado pelo Git e não é montado
no container; o Compose passa apenas as variáveis declaradas.

## 3. Subir e criar o login

O primeiro comando valida a configuração sem exibir secrets. O segundo baixa a
imagem fixa e inicia somente o n8n, aguardando o teste de saúde:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml config --quiet
docker compose --env-file .env -f infra/n8n/compose.yaml up -d --wait n8n
```

Abrir `http://localhost:5678/` e criar a conta do dono com senha forte. Só depois
ligar o túnel. O login nativo do n8n permanece obrigatório; não há usuário ou senha
fixos no repositório. Usar `localhost` no navegador para o cookie de sessão local.

Para conferir o estado do container:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml ps
```

O serviço deve aparecer como `healthy` e publicar `127.0.0.1:5678`, sem acesso pela
rede local. O volume `zenvolyx-local_n8n_data` guarda workflows, credenciais,
Data tables e o banco SQLite. O Compose recusa iniciar se alguma variável obrigatória
estiver vazia ou a pasta `clients/` não existir.

## 4. Ligar o túnel só durante testes externos

Com o login já criado, este comando inicia o túnel e o próximo mostra a URL HTTPS
aleatória terminada em `trycloudflare.com`:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml --profile tunnel up -d tunnel
docker compose --env-file .env -f infra/n8n/compose.yaml logs --tail 50 tunnel
```

O Quick Tunnel não exige conta ou domínio. Enquanto estiver ligado, torna a instância
acessível pela Internet, incluindo a tela de login; use o editor pelo endereço local.
Este ambiente não é a configuração de produção.

No `.env`, substituir **somente** `WEBHOOK_URL` pela URL recebida, com `/` no final.
Recriar só o n8n para aplicar a variável, mantendo o túnel ligado:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml up -d --no-deps --force-recreate --wait n8n
```

Conferir a URL mostrada pelo nó Webhook no editor. Usar `/webhook-test/` apenas
enquanto o nó estiver escutando um teste e `/webhook/` com o workflow publicado.
Para ligar o app da Meta, seguir o [README da entrada do WhatsApp](../../automations/whatsapp-inbound/README.md#ligar-o-app-de-teste-da-meta) (T019).

Recriar o túnel pode mudar sua URL: atualizar `.env`, recriar o n8n e atualizar o
callback no fornecedor a cada mudança. Para fechar o acesso externo:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml --profile tunnel stop tunnel
```

Depois, restaurar `WEBHOOK_URL=http://localhost:5678/` e recriar só o n8n com o comando
acima. O túnel não inicia junto do Docker; o perfil é opcional e não tem reinício automático.

## 5. Retenção e acesso a arquivos

- Sucesso, execução manual e progresso de cada nó: não salvar dados de execução.
- Erro de execução de produção: salvar para diagnóstico e tornar elegível para limpeza
  após **168 horas (7 dias)**, com limite adicional de **1.000 execuções**.
- A exclusão é periódica, com intervalo e margem de segurança do n8n; não ocorre
  exatamente ao completar 168 horas. Workflows podem sobrescrever as opções de
  salvamento: manter o padrão do ambiente nas configurações de cada workflow.
- Data tables não são apagadas por essa retenção. A limpeza do estado da conversa
  após 30 dias fica no workflow da T028; este Compose não a implementa.
- `clients/` é montada em `/files/clients`, somente leitura. Usar o nó **Read/Write
  Files from Disk** para ler `/files/clients/*/config.json` na T016. A restrição
  `N8N_RESTRICT_FILE_ACCESS_TO` libera apenas esse diretório para esses nós.

Usar somente dados fictícios nos testes e não registrar payloads pessoais em logs.
Logs dos containers têm rotação de 10 MB por arquivo, com até três arquivos.
`CODE_ENABLE_STDOUT` manda o `console.log` dos nós Code para o log do n8n, onde os fluxos
registram só eventos sem dados pessoais (ex.: [entrada do WhatsApp](../../automations/whatsapp-inbound/README.md#logs)).
Para ver as últimas linhas:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml logs --tail 50 n8n
```

## 6. Verificar o ambiente e parar

Após iniciar o Docker e o n8n:

1. Confirmar `healthy` em `compose ps` e a tela de login em uma janela privada.
2. No editor, criar uma Data table de teste com uma linha fictícia; reiniciar o n8n
   com o comando abaixo e conferir que a linha permanece. Depois, apagar a tabela de teste.
3. Num workflow temporário, usar Read/Write Files from Disk para ler
   `/files/clients/_template/config.json`. A leitura deve funcionar; escrita na pasta
   e leitura de arquivos fora dela devem ser recusadas. Não exportar esse teste.
4. Testar um Webhook com payload fictício pelo túnel. Para conferir a política de
   execução, usar um workflow publicado que termine com sucesso e outro que falhe:
   o histórico deve guardar apenas o erro. Execuções manuais não ficam salvas.
5. Desligar o túnel após o teste. A URL pública deve deixar de responder pelo túnel.

Este comando reinicia somente o processo, preservando o volume (não relê o `.env`):

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml restart n8n
```

Para parar tudo e remover os containers, preservando os dados:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml --profile tunnel down
```

**Não adicionar `--volumes` ou `-v` ao `down`: isso apaga o banco e as credenciais.**
Antes de atualizar a versão, parar o n8n e fazer backup do volume pelo Docker Desktop,
junto da chave do `.env`. Testar a restauração numa instância separada; não basta guardar
os JSONs dos workflows. Atualizar a tag de propósito e repetir as verificações acima.

As verificações do repositório continuam sendo `npm test`, `npm run lint` e
`npm run typecheck`; elas não substituem os testes dos containers.

Para testar Data tables nesta versão, usar o editor ou um webhook no servidor:
o comando isolado `n8n execute` não inicializou esse módulo na validação da T012.

## 7. Comandos da CLI do n8n

Importam, exportam e publicam workflows sem abrir o editor. Rodar na raiz, com o n8n
ligado. O `-e N8N_RUNNERS_BROKER_PORT=5690` evita conflito com o n8n em execução, que já
usa a porta interna 5679; sem ele, o comando para com "port 5679 is already in use".
Este exemplo lista os workflows da instância:

```powershell
docker compose --env-file .env -f infra/n8n/compose.yaml exec -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n list:workflow
```

Trocando `list:workflow` por:

- `import:workflow --input=/tmp/<nome>.json`: importa mantendo o `id` do JSON e despublica.
  Antes, copiar o arquivo com `docker compose --env-file .env -f infra/n8n/compose.yaml cp <arquivo> n8n:/tmp/<nome>.json`.
- `publish:workflow --id=<id>`: publica. Sub-workflows precisam estar publicados para serem
  chamados; depois de publicar pela CLI, reiniciar o n8n (seção 6) para valer no servidor.
- `export:workflow --id=<id> --pretty --output=/tmp/<nome>.json`: exporta; trazer o arquivo
  com `cp n8n:/tmp/<nome>.json <destino>` e limpá-lo conforme a D022 antes do commit.
- `execute --id=<id> --rawOutput`: executa um workflow já importado; não aceita mais
  arquivo e não inicializa Data tables.

Não há comando para apagar workflow: workflows de teste ficam arquivados e são apagados
pelo editor.

IDs de workflow precisam ter 16 letras e números. Um ID em outro formato é importado e
publicado, mas não pode ser chamado como sub-workflow (D024).

## Referências

- [Release fixa do n8n](https://github.com/n8n-io/n8n/releases/tag/n8n%402.40.5) e [Data tables nessa versão](https://github.com/n8n-io/n8n/blob/n8n%402.40.5/packages/%40n8n/config/src/configs/data-table.config.ts).
- [Variáveis de execução e retenção](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions.md).
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
