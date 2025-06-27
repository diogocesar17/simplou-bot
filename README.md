# 🤖 FinanceBot

Chatbot financeiro para WhatsApp que registra gastos e receitas, salva em Google Sheets e gera resumos mensais.

## 🚀 Deploy no Render (Gratuito)

### 1. Preparação
- Crie uma conta no [Render](https://render.com)
- Conecte seu repositório GitHub

### 2. Configuração
1. Clique em "New +" → "Blueprint"
2. Conecte seu repositório
3. Render detectará automaticamente o `render.yaml`
4. Configure as variáveis de ambiente:
   - `GOOGLE_SHEETS_CREDENTIALS` (JSON das credenciais Google)
   - `GOOGLE_SHEETS_ID` (ID da planilha)
   - `REDIS_URL` (URL do Redis - será gerada automaticamente)
   - `DATABASE_URL` (URL do PostgreSQL - será gerada automaticamente)

### 3. Deploy
- Render criará automaticamente:
  - Web Service (Node.js)
  - Redis Database
  - PostgreSQL Database
- Aguarde o deploy completar (~5-10 minutos)

## 🔧 Configuração Local

### Pré-requisitos
- Node.js 18+
- Redis
- PostgreSQL
- Google Sheets API

### Instalação
```bash
npm install
```

### Variáveis de Ambiente
Crie um arquivo `.env`:
```env
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/financebot
```

### Execução
```bash
npm start
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

### Registrar Lançamentos
- "gastei 50 no mercado com pix"
- "recebi 1000 salário com crédito"
- "paguei 120 aluguel com débito"

## 🏗️ Arquitetura

- **WhatsApp**: @whiskeysockets/baileys
- **Banco de Dados**: Google Sheets + PostgreSQL
- **Cache**: Redis
- **Hospedagem**: Render (gratuito)

## 📊 Funcionalidades

- ✅ Registro de gastos e receitas
- ✅ Categorização inteligente
- ✅ Resumos mensais
- ✅ Análise por categoria
- ✅ Edição e exclusão de lançamentos
- ✅ Histórico de lançamentos
- ✅ Validação de valores
- ✅ Confirmação de novas categorias

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
