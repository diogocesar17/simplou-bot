# 👥 Sistema de Usuários Automatizado

## 📋 **Resumo da Implementação**

O sistema de usuários foi completamente automatizado, eliminando a necessidade de deploy manual para adicionar/remover usuários. Agora todos os usuários são gerenciados via comandos do bot.

---

## 🗄️ **Estrutura do Banco de Dados**

### **Tabela: `usuarios`**
```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL UNIQUE, -- WhatsApp ID
  nome VARCHAR(100),
  telefone VARCHAR(20),
  plano VARCHAR(20) NOT NULL DEFAULT 'gratuito', -- 'gratuito', 'premium'
  status VARCHAR(20) DEFAULT 'ativo', -- 'ativo', 'inativo', 'bloqueado'
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_ultimo_acesso TIMESTAMP,
  data_expiracao_premium TIMESTAMP,
  is_admin BOOLEAN DEFAULT FALSE,
  criado_por VARCHAR(50), -- quem cadastrou
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Índices Otimizados:**
- `idx_usuarios_user_id` - Busca rápida por usuário
- `idx_usuarios_plano` - Filtros por plano
- `idx_usuarios_status` - Filtros por status
- `idx_usuarios_admin` - Busca de administradores

---

## 📱 **Comandos de Administração**

### **Cadastrar Usuário**
```
cadastrar 5511999999999 Nome do Usuário
```
- Adiciona usuário ao plano gratuito
- Envia mensagem de boas-vindas
- Registra log de auditoria

### **Promover para Premium**
```
premium 5511999999999 [dias]
```
- Promove usuário para plano premium
- Define expiração (opcional)
- Envia notificação ao usuário
- Exemplo: `premium 5511999999999 30` (30 dias)

### **Remover Usuário**
```
remover 5511999999999
```
- Remove usuário do sistema
- Bloqueia acesso imediatamente
- Não permite remover administradores

### **Listar Usuários**
```
usuarios
```
- Lista todos os usuários
- Mostra plano, status e último acesso
- Inclui resumo estatístico

### **Status de Usuário**
```
status 5511999999999
```
- Mostra detalhes completos do usuário
- Histórico de acesso
- Dias restantes de premium

---

## 🔄 **Migração Automática**

### **Processo de Migração:**
1. **Verificação:** Checa se já existem usuários na tabela
2. **Migração de Admins (legado):** Converte `ADMIN_USERS` (env) para premium
3. **Migração de Usuários (legado):** Converte `AUTHORIZED_USERS` (env) para gratuito
4. **Logs:** Registra todo o processo
5. **Observação:** Após a migração, o fluxo de autorização passa a ser 100% via banco.

### **Execução:**
- Automática na inicialização do banco
- Executa apenas uma vez
- Preserva dados existentes

---

## 🛡️ **Sistema de Segurança**

### **Validações:**
- ✅ Formato de telefone brasileiro
- ✅ Verificação de duplicatas
- ✅ Proteção contra remoção de admins
- ✅ Logs de auditoria completos

### **Controle de Acesso:**
- ✅ Serviço central `authorizationService` (Node/TS)
- ✅ Fallback seguro via `SUPER_ADMINS` (env)
- ✅ Verificação automática em todas as operações
- ✅ Registro de último acesso
- ✅ Conversão automática de premium expirado

---

## 🔔 **Sistema de Alertas**

### **Alertas Premium:**
- **7 dias antes** da expiração
- **No dia da expiração**
- **Conversão automática** para gratuito

### **Integração:**
- Mesmo horário dos alertas existentes (8h-12h)
- Mesmo sistema de notificação
- Logs detalhados

---

## 📊 **Funcionalidades Implementadas**

### **✅ Completas:**
- [x] Cadastro automático de usuários
- [x] Promoção para premium
- [x] Remoção de usuários
- [x] Listagem com filtros
- [x] Verificação de acesso
- [x] Sistema de alertas
- [x] Logs de auditoria
- [x] Migração automática

### **✅ Integrações:**
- [x] Middleware de autenticação
- [x] Comandos administrativos
- [x] Sistema de alertas
- [x] Logs de auditoria
- [x] Mensagens personalizadas

---

## 🧪 **Testes**

### **Script de Teste:**
```bash
node test-sistema-usuarios.js
```

### **Testes Incluídos:**
1. ✅ Inicialização do banco
2. ✅ Cadastro de usuário
3. ✅ Busca de usuário
4. ✅ Verificação de acesso
5. ✅ Promoção premium
6. ✅ Listagem de usuários
7. ✅ Status de usuário
8. ✅ Verificação de admin
9. ✅ Geração de mensagens
10. ✅ Alertas de expiração

---

## 📈 **Próximos Passos**

### **Funcionalidades Premium (Próximas):**
- [ ] Sistema de metas financeiras
- [ ] Análises inteligentes com Gemini
- [ ] Relatórios avançados
- [ ] Alertas personalizados

### **Melhorias Futuras:**
- [ ] Interface web para administração
- [ ] Integração com gateway de pagamento
- [ ] Sistema de convites
- [ ] Estatísticas avançadas

---

## 🎯 **Como Usar**

### **Para Administradores:**
1. **Cadastrar usuário:** `cadastrar 5511999999999 João Silva`
2. **Promover premium:** `premium 5511999999999 30`
3. **Listar usuários:** `usuarios`
4. **Ver status:** `status 5511999999999`
5. **Remover usuário:** `remover 5511999999999`

### **Para Usuários:**
- Acesso automático após cadastro
- Notificações de promoção premium
- Alertas de expiração
- Conversão automática para gratuito

---

## 📝 **Logs de Auditoria**

### **Tipos de Logs:**
- `CADASTRO_USUARIO` - Novo usuário cadastrado
- `PROMOCAO_PREMIUM` - Usuário promovido
- `EXCLUSAO_USUARIO` - Usuário removido

### **Informações Registradas:**
- Usuário que executou a ação
- Detalhes da operação
- Timestamp da ação
- Dados do usuário afetado

---

**✅ Sistema implementado e funcionando!** 🚀 
