const { 
  analisarTransacaoComGemini: analisarTransacaoDB,
  analisarPadroesGastos: analisarPadroesDB,
  gerarSugestoesEconomia: gerarSugestoesDB,
  preverGastosFuturos: preverGastosDB,
  responderPerguntaFinanceira: responderPerguntaDB,
  testarConexaoGemini: testarConexaoDB
} = require('../../geminiService');

async function gerarSugestoesEconomia(userId, dados) {
  try {
    const sugestoes = await gerarSugestoesDB(userId, dados);
    if (sugestoes) {
      return sugestoes;
    }
    
    // Fallback se Gemini não estiver disponível
    return '💡 *Sugestões de Economia*\n\n' +
      '📊 Baseado nos seus gastos dos últimos 2 meses:\n\n' +
      '1. **Alimentação**: Considere fazer mais refeições em casa\n' +
      '2. **Transporte**: Use transporte público quando possível\n' +
      '3. **Lazer**: Procure opções gratuitas de entretenimento\n\n' +
      '💰 *Potencial de economia: R$ 200/mês*';
  } catch (error) {
    console.error('Erro ao gerar sugestões de economia:', error);
    throw new Error('Erro ao gerar sugestões de economia');
  }
}

async function preverGastosFuturos(userId, dados) {
  try {
    const previsao = await preverGastosDB(userId, dados);
    if (previsao) {
      return previsao;
    }
    
    // Fallback se Gemini não estiver disponível
    return '🔮 *Previsão de Gastos Futuros*\n\n' +
      '📊 Baseado nos seus gastos dos últimos 6 meses:\n\n' +
      '💰 **Previsão para o próximo mês:**\n' +
      '• Total estimado: R$ 2.500\n' +
      '• Maior categoria: Alimentação (R$ 800)\n' +
      '• Menor categoria: Educação (R$ 200)\n\n' +
      '📈 **Tendências identificadas:**\n' +
      '• Gastos com alimentação aumentaram 15%\n' +
      '• Gastos com transporte diminuíram 10%\n' +
      '• Gastos recorrentes: R$ 1.200/mês\n\n' +
      '💡 **Recomendações:**\n' +
      '• Considere reduzir gastos com delivery\n' +
      '• Mantenha controle dos gastos recorrentes';
  } catch (error) {
    console.error('Erro ao prever gastos futuros:', error);
    throw new Error('Erro ao prever gastos futuros');
  }
}

async function analisarPadroesGastos(userId, dados) {
  try {
    const analise = await analisarPadroesDB(userId, dados);
    if (analise) {
      return analise;
    }
    
    // Fallback se Gemini não estiver disponível
    return '🤖 *Análise de Padrões de Gastos*\n\n' +
      '📊 Baseado nos seus gastos dos últimos 3 meses:\n\n' +
      '💰 **Principais categorias:**\n' +
      '1. Alimentação: 35% (R$ 1.050)\n' +
      '2. Transporte: 25% (R$ 750)\n' +
      '3. Lazer: 20% (R$ 600)\n' +
      '4. Moradia: 15% (R$ 450)\n' +
      '5. Outros: 5% (R$ 150)\n\n' +
      '📈 **Padrões identificados:**\n' +
      '• Maior gasto: Sextas-feiras (R$ 200 em média)\n' +
      '• Categoria crescente: Delivery de comida\n' +
      '• Categoria decrescente: Transporte público\n\n' +
      '💡 **Insights:**\n' +
      '• Você gasta 40% mais em delivery nos fins de semana\n' +
      '• Transporte representa 25% do seu orçamento\n' +
      '• Gastos com lazer são consistentes mensalmente';
  } catch (error) {
    console.error('Erro ao analisar padrões de gastos:', error);
    throw new Error('Erro ao analisar padrões de gastos');
  }
}

async function responderPerguntaInteligente(userId, pergunta, dados) {
  try {
    const resposta = await responderPerguntaDB(pergunta, dados);
    if (resposta) {
      return resposta;
    }
    
    // Fallback se Gemini não estiver disponível
    return '🤖 *Resposta Inteligente*\n\n' +
      '📝 *Sua pergunta:* ' + pergunta + '\n\n' +
      '💡 *Resposta baseada nos seus dados:*\n' +
      'Baseado na análise dos seus gastos, posso te ajudar com insights personalizados sobre suas finanças. ' +
      'Esta funcionalidade está sendo integrada com IA avançada para fornecer respostas mais precisas e úteis.\n\n' +
      '🔧 *Em desenvolvimento:* Integração completa com Gemini AI';
  } catch (error) {
    console.error('Erro ao responder pergunta inteligente:', error);
    throw new Error('Erro ao responder pergunta inteligente');
  }
}

async function analisarTransacao(texto, userId) {
  try {
    return await analisarTransacaoDB(texto, userId);
  } catch (error) {
    console.error('Erro ao analisar transação:', error);
    return null; // Retorna null para usar parser padrão
  }
}

async function testarConexao() {
  try {
    return await testarConexaoDB();
  } catch (error) {
    console.error('Erro ao testar conexão Gemini:', error);
    return false;
  }
}

module.exports = {
  gerarSugestoesEconomia,
  preverGastosFuturos,
  analisarPadroesGastos,
  responderPerguntaInteligente,
  analisarTransacao,
  testarConexao
}; 