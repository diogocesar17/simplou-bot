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

### Produção (Segurança e Configuração)

- Postgres interno (sem porta exposta):
  - O `docker-compose.yml` não expõe a porta `5432` do Postgres em produção. O serviço do bot acessa o banco via rede interna do Docker.
  - Para desenvolvimento local, se precisar acessar via host, descomente:
    ```yaml
    # ports:
    #   - "5432:5432"
    ```

- `DATABASE_URL` em produção (rede interna):
  - Use o host `postgres` para conectar via rede interna:
    ```env
    DATABASE_URL=postgresql://simplou:simplou123@postgres:5432/simplou
    ```

- Controle de acesso via variáveis de ambiente:
  - Fallback/bootstrapping: configure `SUPER_ADMINS` como lista separada por vírgula.
  - Esses super-admins sempre têm acesso (admin e autorizado), mesmo se o banco estiver vazio.
  - A autorização normal é feita via banco (tabela `usuarios`, campos `status` e `is_admin`).

- Fail-fast na inicialização do banco:
  - Se `initializeDatabase()` falhar, o processo encerra com `process.exit(1)` e o Docker (com `restart: always`) tenta reiniciar até o Postgres estar pronto.
  - Isso evita a instância “viva” mas inoperante.

### Exemplo de `.env` para produção

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://simplou:simplou123@postgres:5432/simplou
GEMINI_API_KEY=sua_chave_api_aqui
SUPER_ADMINS=5511999999999
TZ=America/Sao_Paulo
REDIS_URL=redis://redis:6379
```

## 📄 Licença

MIT License
