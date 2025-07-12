# 🤖 Configuração do Gemini AI

## 📋 Pré-requisitos

1. **Conta Google** com acesso ao Google AI Studio
2. **API Key** do Gemini AI

## 🔑 Como obter a API Key do Gemini

### Passo 1: Acessar Google AI Studio
1. Vá para [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Faça login com sua conta Google

### Passo 2: Criar API Key
1. Clique em "Create API Key"
2. Escolha "Create API Key in new project" ou use um projeto existente
3. Copie a API Key gerada

### Passo 3: Configurar no projeto
1. Adicione a API Key no arquivo `.env`:
```env
GEMINI_API_KEY=sua-api-key-aqui
```

## 🧪 Testando a configuração

Execute o teste para verificar se tudo está funcionando:

```bash
node test-gemini.js
```

Você deve ver:
```
🧪 Testando integração com Gemini AI...

1️⃣ Testando inicialização...
Resultado: ✅ Sucesso

2️⃣ Testando conectividade...
Resultado: ✅ Sucesso
Mensagem: Conexão com Gemini funcionando!

3️⃣ Testando análise de transações...
📝 Testando: "100 reais de gasolina"
✅ Análise realizada:
   Tipo: gasto
   Valor: 100
   Categoria: Transporte
   Pagamento: Não especificado
   Descrição: de gasolina
   Confiança: alta

🎉 Testes concluídos!
```

## 🚀 Funcionalidades disponíveis

### ✅ Implementadas (Fase 1)
- [x] Análise inteligente de transações
- [x] Categorização automática
- [x] Detecção de forma de pagamento
- [x] Integração com parser existente

### 🔄 Em desenvolvimento
- [ ] Análise de padrões de gastos
- [ ] Sugestões de economia
- [ ] Previsões de gastos futuros
- [ ] Assistente conversacional

## 💰 Custos

- **Gratuito**: 60 requests/minuto
- **Sem limite diário** significativo
- **Qualidade profissional**

## 🔧 Troubleshooting

### Erro: "API key não configurada"
- Verifique se `GEMINI_API_KEY` está no arquivo `.env`
- Certifique-se de que não há espaços extras

### Erro: "Erro ao inicializar"
- Verifique se a API Key é válida
- Teste a conectividade com a internet

### Erro: "Não conseguiu extrair JSON"
- O Gemini pode estar retornando resposta em formato inesperado
- Verifique os logs para mais detalhes

## 📞 Suporte

Se encontrar problemas:
1. Execute `node test-gemini.js` para diagnóstico
2. Verifique os logs do bot
3. Confirme se a API Key está correta
4. Teste a conectividade com a internet 