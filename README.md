# 🤖 FinanceBot - Bot de Controle Financeiro para WhatsApp

Bot inteligente para controle de gastos e receitas via WhatsApp, com suporte a múltiplos usuários e banco de dados PostgreSQL.

## ✨ Funcionalidades

- 📊 **Resumos financeiros** por mês/ano
- 📂 **Análise por categorias** com percentuais
- 🔧 **Edição e exclusão** de lançamentos
- 📜 **Histórico** com filtros por período
- 💰 **Registro inteligente** de gastos e receitas
- 🎯 **Categorização automática** com confirmação
- 📅 **Suporte a datas específicas** (passadas/futuras)
- 👥 **Multiusuário** - cada usuário tem seus dados isolados

## 🚀 Deploy no Railway

### 1. Preparação

1. **Fork/Clone** este repositório
2. **Configure as variáveis de ambiente** (veja seção abaixo)
3. **Conecte ao Railway** via GitHub

### 2. Configuração no Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project" → "Deploy from GitHub repo"
3. Selecione seu repositório
4. Adicione um **PostgreSQL Database**:
   - Clique em "New" → "Database" → "PostgreSQL"
   - Railway irá gerar automaticamente a variável `DATABASE_URL`

### 3. Variáveis de Ambiente

Configure estas variáveis no Railway:

```env
# Configurações do WhatsApp
WHATSAPP_SESSION_NAME=financebot

# Configurações do PostgreSQL (gerado automaticamente pelo Railway)
DATABASE_URL=postgresql://username:password@host:port/database

# Configurações do Redis (para sessão do WhatsApp)
REDIS_URL=redis://localhost:6379

# Configurações do ambiente
NODE_ENV=production
PORT=3000
```

### 4. Deploy

1. **Commit e push** suas alterações para o GitHub
2. O Railway fará **deploy automático**
3. Acesse os **logs** para ver o QR Code do WhatsApp
4. **Escaneie o QR Code** com seu WhatsApp

## 🛠️ Desenvolvimento Local

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- Redis (opcional, para sessão)

### Instalação

```bash
# Clone o repositório
git clone <seu-repo>
cd financebot

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp env.example .env
# Edite o arquivo .env com suas configurações

# Inicie o bot
npm start
```

### Estrutura do Projeto

```
financebot/
├── index.js              # Arquivo principal do bot
├── databaseService.js    # Serviço de banco PostgreSQL
├── messageParser.js      # Parser de mensagens
├── authRedisStorage.js   # Autenticação WhatsApp
├── googleSheetService.js # Serviço Google Sheets (legado)
├── package.json
├── Procfile             # Configuração Railway
└── env.example          # Exemplo de variáveis
```

## 📱 Comandos Disponíveis

### Resumos
- `resumo` - Resumo do mês atual
- `resumo janeiro 2024` - Resumo de mês específico
- `resumo jan 2024` - Resumo com abreviação

### Análise por Categoria
- `categorias` - Gastos por categoria (mês atual)
- `categorias janeiro 2024` - Categorias de mês específico
- `categoria alimentação` - Detalhes da categoria

### Edição e Exclusão
- `editar <N>` - Editar lançamento pelo número do histórico
- `excluir <N>` - Excluir lançamento pelo número do histórico

### Histórico
- `histórico` ou `ultimos 5` - Ver últimos lançamentos
- `histórico junho 2024` - Histórico de mês específico

### Registrar Lançamentos
- "gastei 50 no mercado com pix"
- "recebi 1000 salário com crédito"
- "paguei 120 aluguel com débito"

## 🗄️ Banco de Dados

### Estrutura da Tabela

```sql
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL,
  data DATE NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'gasto')),
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL,
  categoria VARCHAR(50),
  pagamento VARCHAR(20),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Índices

- `idx_lancamentos_user_id` - Para filtrar por usuário
- `idx_lancamentos_data` - Para consultas por data
- `idx_lancamentos_categoria` - Para análises por categoria

## 🔄 Migração do Google Sheets

O bot agora usa PostgreSQL como banco principal, mas mantém compatibilidade com Google Sheets para backup:

1. **Configure** as credenciais do Google Sheets no `.env`
2. **Mantenha** o `googleSheetService.js` para backup
3. **Dados isolados** por usuário via `user_id`

## 🚀 Próximos Passos

- [ ] API própria do WhatsApp (Twilio)
- [ ] App React com gráficos
- [ ] Relatórios avançados
- [ ] Exportação de dados
- [ ] Notificações automáticas

## 📝 Licença

ISC

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**Desenvolvido com ❤️ para controle financeiro inteligente**
