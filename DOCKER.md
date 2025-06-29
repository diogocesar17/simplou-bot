# 🐳 FinanceBot com Docker

Este guia mostra como rodar o FinanceBot usando Docker para garantir que fique online 24h por dia.

## 📋 Pré-requisitos

- Docker instalado
- Docker Compose instalado
- Variáveis de ambiente configuradas

## 🚀 Início Rápido

### 1. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Banco de dados
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (Upstash ou local)
REDIS_URL=redis://user:password@host:port

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_ID=your_sheet_id

# Ambiente
NODE_ENV=production
PORT=3000
```

### 2. Use o script de gerenciamento

```bash
# Dar permissão de execução (primeira vez)
chmod +x docker-run.sh

# Iniciar o bot
./docker-run.sh start

# Ver logs
./docker-run.sh logs

# Parar o bot
./docker-run.sh stop
```

## 🔧 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `./docker-run.sh start` | Inicia o FinanceBot |
| `./docker-run.sh stop` | Para o FinanceBot |
| `./docker-run.sh restart` | Reinicia o FinanceBot |
| `./docker-run.sh logs` | Mostra logs em tempo real |
| `./docker-run.sh build` | Reconstrói a imagem |
| `./docker-run.sh status` | Mostra status dos containers |
| `./docker-run.sh clean` | Limpa containers e volumes |

## 🏗️ Opções de Deploy

### Opção 1: Apenas o Bot (Recomendado para produção)

Use apenas o serviço `financebot` e conecte com bancos externos:

```bash
# Edite o docker-compose.yml e comente os serviços postgres e redis
# Depois execute:
docker-compose up -d financebot
```

### Opção 2: Stack Completo (Para desenvolvimento)

Roda PostgreSQL e Redis localmente:

```bash
docker-compose up -d
```

## 🔄 Reinicialização Automática

O container está configurado com `restart: always`, que significa:

- ✅ Reinicia automaticamente se o processo principal parar
- ✅ Reinicia automaticamente se o Docker daemon reiniciar
- ✅ Reinicia automaticamente se a máquina reiniciar

## 📊 Monitoramento

### Health Check

O container inclui um health check que verifica se a aplicação está respondendo:

```bash
# Verificar status de saúde
docker inspect financebot | grep -A 10 "Health"
```

### Logs

```bash
# Logs em tempo real
./docker-run.sh logs

# Últimas 100 linhas
docker-compose logs --tail=100 financebot

# Logs com timestamp
docker-compose logs -t financebot
```

## 💾 Persistência de Dados

### Autenticação WhatsApp

Os dados de autenticação são persistidos no volume `./auth`:

```yaml
volumes:
  - ./auth:/app/auth
```

### Banco de Dados (se usar local)

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

## 🔧 Configurações Avançadas

### Limites de Recursos

O container está limitado a 512MB de RAM. Para alterar:

```yaml
deploy:
  resources:
    limits:
      memory: 1G  # Aumentar para 1GB
```

### Variáveis de Ambiente

Adicione suas variáveis no `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_URL=postgresql://...
  - REDIS_URL=redis://...
```

## 🚨 Troubleshooting

### Container não inicia

```bash
# Verificar logs de erro
docker-compose logs financebot

# Verificar se as variáveis estão corretas
docker-compose config
```

### Problemas de conectividade

```bash
# Verificar se os containers estão rodando
./docker-run.sh status

# Verificar conectividade de rede
docker network ls
docker network inspect financebot_financebot-network
```

### Limpeza completa

```bash
# Parar e remover tudo
./docker-run.sh clean

# Reconstruir do zero
./docker-run.sh build
./docker-run.sh start
```

## 🌐 Deploy em Produção

### VPS (DigitalOcean, AWS, etc.)

1. Clone o repositório no servidor
2. Configure as variáveis de ambiente
3. Execute: `./docker-run.sh start`

### Cloud Platforms

Para Render, Fly.io, Railway, etc., use apenas o `Dockerfile`:

```bash
# Build da imagem
docker build -t financebot .

# Push para registry (se necessário)
docker tag financebot your-registry/financebot
docker push your-registry/financebot
```

## 📝 Notas Importantes

- ⚠️ **Autenticação**: Na primeira execução, você precisará escanear o QR Code
- 🔄 **Reinicialização**: O container reinicia automaticamente, mas a sessão do WhatsApp pode precisar de reautenticação
- 💾 **Backup**: Faça backup regular do diretório `./auth` para preservar a sessão
- 📊 **Monitoramento**: Configure alertas para monitorar se o bot está online

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `./docker-run.sh logs`
2. Confirme as variáveis de ambiente
3. Teste localmente primeiro
4. Consulte a documentação do Docker 