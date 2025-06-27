# 🚀 Guia de Migração - Railway para Alternativas Gratuitas

## 📋 Situação Atual
- **Railway**: Plano gratuito excedido
- **Alternativas**: Render, Fly.io, Heroku

## 🎯 Recomendação: Render

### ✅ Vantagens
- 750 horas/mês gratuitas
- PostgreSQL e Redis incluídos
- Deploy automático
- Interface simples
- Suporte a Node.js nativo

### 🔧 Passos para Migração

#### 1. Preparação
```bash
# Clone seu repositório (se ainda não tem)
git clone <seu-repo>
cd financebot

# Commit das novas configurações
git add .
git commit -m "Adiciona configuração para Render"
git push
```

#### 2. Deploy no Render
1. Acesse [render.com](https://render.com)
2. Crie conta gratuita
3. Clique em "New +" → "Blueprint"
4. Conecte seu repositório GitHub
5. Render detectará o `render.yaml` automaticamente

#### 3. Configurar Variáveis de Ambiente
No painel do Render, configure:
- `GOOGLE_SHEETS_CREDENTIALS` (copie do Railway)
- `GOOGLE_SHEETS_ID` (copie do Railway)
- `NODE_ENV=production`
- `PORT=10000`

#### 4. Aguardar Deploy
- Render criará automaticamente:
  - Web Service (Node.js)
  - Redis Database
  - PostgreSQL Database
- Tempo: ~5-10 minutos

## 🚁 Alternativa: Fly.io

### ✅ Vantagens
- 3 VMs gratuitas
- Performance global
- Muito generoso

### 🔧 Deploy no Fly.io
```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly launch
fly deploy

# Configurar variáveis
fly secrets set GOOGLE_SHEETS_CREDENTIALS="..."
fly secrets set GOOGLE_SHEETS_ID="..."
```

## 🏰 Alternativa: Heroku

### ✅ Vantagens
- 550-1000 horas/mês
- Muito popular
- Documentação extensa

### ⚠️ Limitações
- Dorme após 30min inativo
- PostgreSQL como add-on pago

### 🔧 Deploy no Heroku
```bash
# Instalar Heroku CLI
# Deploy via GitHub integration
# Configurar variáveis no painel
```

## 📊 Comparação de Custos

| Plataforma | Limite Gratuito | PostgreSQL | Redis | Dorme |
|------------|----------------|------------|-------|-------|
| **Render** | 750h/mês | ✅ | ✅ | ❌ |
| **Fly.io** | 3 VMs | ✅ | ✅ | ❌ |
| **Heroku** | 550-1000h/mês | ❌ | ❌ | ✅ |
| **Railway** | $5/mês | ✅ | ✅ | ❌ |

## 🔄 Migração de Dados

### PostgreSQL
- Exporte dados do Railway:
```bash
pg_dump $DATABASE_URL > backup.sql
```
- Importe no novo banco:
```bash
psql $NEW_DATABASE_URL < backup.sql
```

### Redis
- Dados de sessão serão perdidos
- WhatsApp precisará reconectar
- Não é crítico para funcionamento

## 🎯 Próximos Passos

1. **Escolha Render** (recomendado)
2. **Configure deploy** seguindo o guia
3. **Teste funcionamento**
4. **Migre dados** se necessário
5. **Desconecte Railway** após confirmação

## 🆘 Suporte

Se encontrar problemas:
1. Verifique logs no painel da plataforma
2. Confirme variáveis de ambiente
3. Teste localmente primeiro
4. Consulte documentação da plataforma escolhida 