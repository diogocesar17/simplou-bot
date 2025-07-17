# 🤖 Simplou

Um bot inteligente para WhatsApp que ajuda você a controlar suas finanças pessoais de forma simples e eficiente.

## ✨ Funcionalidades

- 💰 **Registro de gastos e receitas** com categorização automática
- 📊 **Resumos mensais** e relatórios detalhados
- 💳 **Gestão de cartões de crédito** com controle de faturas
- 🔄 **Lançamentos recorrentes** e parcelamentos
- 🤖 **IA integrada** para análise inteligente de gastos
- 📈 **Histórico completo** com filtros por período
- 🔔 **Sistema de alertas** para vencimentos
- 📱 **Interface WhatsApp** intuitiva e fácil de usar

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- PostgreSQL
- Conta no Google Cloud (para IA)
- Número de WhatsApp

### Configuração

1. **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/simplou-bot.git
cd simplou-bot
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/simplou
GEMINI_API_KEY=sua_chave_api_aqui
```

4. **Inicialize o banco de dados:**
```bash
npm run setup
```

5. **Inicie o bot:**
```bash
npm start
```

## 📱 Como usar

Envie mensagens para o bot no WhatsApp:

- `gastei 50 no mercado` - Registra um gasto
- `recebi 1000 salário` - Registra uma receita
- `resumo` - Ver resumo do mês
- `histórico` - Ver últimos lançamentos
- `ajuda` - Menu completo de comandos

## 🐳 Docker

Para rodar com Docker:

```bash
docker-compose up -d
```

## 📄 Licença

MIT License
