const { appendRowToDatabase, queryDatabase } = require('./databaseService');

// Configurações dos alertas
const CONFIG_ALERTAS = {
  CARTEES: {
    DIAS_ANTES: 3,
    ALERTA_DIA_VENCIMENTO: true,
    ALERTA_FECHAMENTO: false
  },
  BOLETOS: {
    DIAS_ANTES: 3,
    ALERTA_DIA_VENCIMENTO: true
  },
  HORARIO: {
    INICIO: 8, // 8h da manhã
    FIM: 12    // 12h (meio-dia)
  }
};

/**
 * Verifica se deve enviar alertas no horário atual
 */
function deveEnviarAlertas() {
  const agora = new Date();
  const hora = agora.getHours();
  
  // Verifica se está no período da manhã (8h às 12h)
  return hora >= CONFIG_ALERTAS.HORARIO.INICIO && hora < CONFIG_ALERTAS.HORARIO.FIM;
}

/**
 * Calcula a data de vencimento do cartão para o mês atual
 */
function calcularVencimentoCartao(diaVencimento) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth(); // 0-11
  
  // Cria a data de vencimento para o mês atual
  const dataVencimento = new Date(ano, mes, diaVencimento);
  
  // Se a data já passou neste mês, pega o próximo mês
  if (dataVencimento < hoje) {
    dataVencimento.setMonth(mes + 1);
  }
  
  return dataVencimento;
}

/**
 * Verifica se deve enviar alerta para cartão de crédito
 */
function deveAlertarCartao(diaVencimento) {
  const hoje = new Date();
  const dataVencimento = calcularVencimentoCartao(diaVencimento);
  
  // Calcula a diferença em dias
  const diffTempo = dataVencimento.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
  
  // Alerta 3 dias antes
  if (diffDias === CONFIG_ALERTAS.CARTEES.DIAS_ANTES) {
    return { deveAlertar: true, tipo: '3_dias_antes', diasRestantes: diffDias };
  }
  
  // Alerta no dia do vencimento
  if (diffDias === 0 && CONFIG_ALERTAS.CARTEES.ALERTA_DIA_VENCIMENTO) {
    return { deveAlertar: true, tipo: 'dia_vencimento', diasRestantes: 0 };
  }
  
  return { deveAlertar: false };
}

/**
 * Verifica se deve enviar alerta para boleto
 */
function deveAlertarBoleto(dataVencimento) {
  const hoje = new Date();
  const dataVencimentoObj = new Date(dataVencimento);
  
  // Calcula a diferença em dias
  const diffTempo = dataVencimentoObj.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
  
  // Alerta 3 dias antes
  if (diffDias === CONFIG_ALERTAS.BOLETOS.DIAS_ANTES) {
    return { deveAlertar: true, tipo: '3_dias_antes', diasRestantes: diffDias };
  }
  
  // Alerta no dia do vencimento
  if (diffDias === 0 && CONFIG_ALERTAS.BOLETOS.ALERTA_DIA_VENCIMENTO) {
    return { deveAlertar: true, tipo: 'dia_vencimento', diasRestantes: 0 };
  }
  
  return { deveAlertar: false };
}

/**
 * Busca cartões configurados para alertas
 */
async function buscarCartoesParaAlerta() {
  try {
    const query = `
      SELECT DISTINCT nome_cartao, dia_vencimento 
      FROM cartoes_config 
      WHERE dia_vencimento IS NOT NULL
    `;
    
    const cartoes = await queryDatabase(query);
    return cartoes;
  } catch (error) {
    console.error('[ALERTAS] Erro ao buscar cartões:', error);
    return [];
  }
}

/**
 * Busca boletos para alertas
 */
async function buscarBoletosParaAlerta() {
  try {
    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setDate(hoje.getDate() + 7); // Busca boletos dos próximos 7 dias
    
    const query = `
      SELECT id, descricao, valor, data_vencimento, categoria
      FROM lancamentos 
      WHERE pagamento = 'BOLETO' 
      AND data_vencimento IS NOT NULL 
      AND data_vencimento >= $1 
      AND data_vencimento <= $2
      ORDER BY data_vencimento ASC
    `;
    
    const boletos = await queryDatabase(query, [
      hoje.toISOString().split('T')[0],
      dataLimite.toISOString().split('T')[0]
    ]);
    
    return boletos;
  } catch (error) {
    console.error('[ALERTAS] Erro ao buscar boletos:', error);
    return [];
  }
}

/**
 * Gera mensagem de alerta para cartão
 */
function gerarMensagemAlertaCartao(cartao, tipoAlerta, diasRestantes) {
  const dataVencimento = calcularVencimentoCartao(cartao.dia_vencimento);
  const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
  
  if (tipoAlerta === '3_dias_antes') {
    return `💳 *Alerta de Cartão de Crédito*\n\n` +
           `Cartão: ${cartao.nome_cartao}\n` +
           `Vencimento: ${dataFormatada}\n` +
           `⏰ Faltam ${diasRestantes} dias para o vencimento\n\n` +
           `💡 Lembre-se de pagar a fatura!`;
  } else if (tipoAlerta === 'dia_vencimento') {
    return `🚨 *VENCIMENTO HOJE!*\n\n` +
           `Cartão: ${cartao.nome_cartao}\n` +
           `Vencimento: ${dataFormatada}\n\n` +
           `⚠️ A fatura vence hoje!`;
  }
}

/**
 * Gera mensagem de alerta para boleto
 */
function gerarMensagemAlertaBoleto(boleto, tipoAlerta, diasRestantes) {
  const dataVencimento = new Date(boleto.data_vencimento);
  const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
  
  if (tipoAlerta === '3_dias_antes') {
    return `📄 *Alerta de Boleto*\n\n` +
           `Descrição: ${boleto.descricao}\n` +
           `Valor: R$ ${boleto.valor.toFixed(2)}\n` +
           `Categoria: ${boleto.categoria}\n` +
           `Vencimento: ${dataFormatada}\n` +
           `⏰ Faltam ${diasRestantes} dias para o vencimento\n\n` +
           `💡 Lembre-se de pagar o boleto!`;
  } else if (tipoAlerta === 'dia_vencimento') {
    return `🚨 *BOLETO VENCE HOJE!*\n\n` +
           `Descrição: ${boleto.descricao}\n` +
           `Valor: R$ ${boleto.valor.toFixed(2)}\n` +
           `Categoria: ${boleto.categoria}\n` +
           `Vencimento: ${dataFormatada}\n\n` +
           `⚠️ O boleto vence hoje!`;
  }
}

/**
 * Função principal para verificar e enviar alertas
 */
async function verificarEEnviarAlertas(sock) {
  // if (!deveEnviarAlertas()) {
  //   console.log('[ALERTAS] Fora do horário de alertas (8h-12h)');
  //   return;
  // }
  
  console.log('[ALERTAS] Iniciando verificação de alertas...');
  
  try {
    // Buscar usuários únicos que têm lançamentos
    const queryUsuarios = `
      SELECT DISTINCT user_id 
      FROM lancamentos 
      WHERE user_id IS NOT NULL
    `;
    
    const usuarios = await queryDatabase(queryUsuarios);
    
    for (const usuario of usuarios) {
      const userId = usuario.user_id;
      
      // Alertas de cartões
      const cartoes = await buscarCartoesParaAlerta();
      for (const cartao of cartoes) {
        const alertaCartao = deveAlertarCartao(cartao.dia_vencimento);
        if (alertaCartao.deveAlertar) {
          const mensagem = gerarMensagemAlertaCartao(cartao, alertaCartao.tipo, alertaCartao.diasRestantes);
          await sock.sendMessage(userId, { text: mensagem });
          console.log(`[ALERTAS] Alerta de cartão enviado para ${userId}: ${cartao.nome_cartao}`);
        }
      }
      
      // Alertas de boletos
      const boletos = await buscarBoletosParaAlerta();
      for (const boleto of boletos) {
        const alertaBoleto = deveAlertarBoleto(boleto.data_vencimento);
        if (alertaBoleto.deveAlertar) {
          const mensagem = gerarMensagemAlertaBoleto(boleto, alertaBoleto.tipo, alertaBoleto.diasRestantes);
          await sock.sendMessage(userId, { text: mensagem });
          console.log(`[ALERTAS] Alerta de boleto enviado para ${userId}: ${boleto.descricao}`);
        }
      }
    }
    
    console.log('[ALERTAS] Verificação de alertas concluída');
  } catch (error) {
    console.error('[ALERTAS] Erro ao verificar alertas:', error);
  }
}

module.exports = {
  verificarEEnviarAlertas,
  deveEnviarAlertas,
  deveAlertarCartao,
  deveAlertarBoleto,
  gerarMensagemAlertaCartao,
  gerarMensagemAlertaBoleto
}; 