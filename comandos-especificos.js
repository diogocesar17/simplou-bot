// Comandos específicos para o bot financeiro
// Este arquivo contém os handlers para os novos comandos específicos

const { logger } = require('./logger');

// Função para formatar valores
function formatarValor(valor, casasDecimais = 2) {
  if (valor === null || valor === undefined) return '0.00';
  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico)) return '0.00';
  return valorNumerico.toFixed(casasDecimais);
}

// Handler para comando parcelados
async function handleParcelados(userId, sock, buscarParceladosAtivos) {
  try {
    const parcelados = await buscarParceladosAtivos(userId, 20);
    
    if (!parcelados || parcelados.length === 0) {
      await sock.sendMessage(userId, { text: '📦 Nenhum parcelamento ativo encontrado.' });
      return;
    }
    
    let msgParcelados = '📦 *Parcelamentos Ativos:*\n\n';
    
    parcelados.forEach((parcelamento, idx) => {
      const parcelasPagas = parcelamento.parcelas.filter(p => p.status === 'paga').length;
      const parcelasPendentes = parcelamento.total_parcelas - parcelasPagas;
      
      msgParcelados += `${idx + 1}. *${parcelamento.descricao}*\n`;
      msgParcelados += `   💰 Total: R$ ${formatarValor(parcelamento.valor_total)}\n`;
      msgParcelados += `   📦 ${parcelamento.total_parcelas}x de R$ ${formatarValor(parcelamento.valor_parcela)}\n`;
      msgParcelados += `   ✅ Pagas: ${parcelasPagas} | ⏳ Pendentes: ${parcelasPendentes}\n`;
      msgParcelados += `   📂 ${parcelamento.categoria} | 💳 ${parcelamento.pagamento}\n`;
      msgParcelados += `   📅 ${parcelamento.primeira_parcela} a ${parcelamento.ultima_parcela}\n\n`;
    });
    
    msgParcelados += '💡 Para excluir um parcelamento, use "excluir [número]" no histórico.';
    
    await sock.sendMessage(userId, { text: msgParcelados });
  } catch (error) {
    logger.error('Erro ao buscar parcelados:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao buscar parcelamentos.' });
  }
}

// Handler para comando recorrentes
async function handleRecorrentes(userId, sock, buscarRecorrentesAtivos) {
  try {
    const recorrentes = await buscarRecorrentesAtivos(userId, 20);
    
    if (!recorrentes || recorrentes.length === 0) {
      await sock.sendMessage(userId, { text: '🔄 Nenhum gasto recorrente/fixo encontrado.' });
      return;
    }
    
    let msgRecorrentes = '🔄 *Gastos Recorrentes/Fixos:*\n\n';
    
    recorrentes.forEach((recorrente, idx) => {
      const recorrenciasPagas = recorrente.recorrencias.filter(r => r.status === 'paga').length;
      const recorrenciasPendentes = recorrente.total_recorrencias - recorrenciasPagas;
      
      msgRecorrentes += `${idx + 1}. *${recorrente.descricao}*\n`;
      msgRecorrentes += `   💰 Valor: R$ ${formatarValor(recorrente.valor)}\n`;
      msgRecorrentes += `   🔄 ${recorrente.total_recorrencias} meses\n`;
      msgRecorrentes += `   ✅ Pagas: ${recorrenciasPagas} | ⏳ Pendentes: ${recorrenciasPendentes}\n`;
      msgRecorrentes += `   📂 ${recorrente.categoria} | 💳 ${recorrente.pagamento}\n`;
      msgRecorrentes += `   📅 ${recorrente.primeira_recorrencia} a ${recorrente.ultima_recorrencia}\n`;
      if (recorrente.recorrente_fim) {
        msgRecorrentes += `   🛑 Fim: ${recorrente.recorrente_fim}\n`;
      }
      msgRecorrentes += '\n';
    });
    
    msgRecorrentes += '💡 Para excluir um recorrente, use "excluir [número]" no histórico.';
    
    await sock.sendMessage(userId, { text: msgRecorrentes });
  } catch (error) {
    logger.error('Erro ao buscar recorrentes:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao buscar gastos recorrentes.' });
  }
}

// Handler para comando vencimentos
async function handleVencimentos(userId, sock, buscarProximosVencimentos, dias = 30) {
  try {
    const vencimentos = await buscarProximosVencimentos(userId, dias);
    
    let msgVencimentos = `📅 *Próximos Vencimentos (${dias} dias):*\n\n`;
    let temVencimentos = false;
    
    // Cartões
    if (vencimentos.cartoes.length > 0) {
      msgVencimentos += '💳 *Faturas de Cartão:*\n';
      vencimentos.cartoes.forEach((venc, idx) => {
        const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
        msgVencimentos += `${emoji} ${venc.cartao_nome}: R$ ${formatarValor(venc.valor)} (${venc.dias_restantes} dias)\n`;
        msgVencimentos += `   📝 ${venc.descricao} | 📂 ${venc.categoria}\n\n`;
      });
      temVencimentos = true;
    }
    
    // Boletos
    if (vencimentos.boletos.length > 0) {
      msgVencimentos += '📄 *Boletos:*\n';
      vencimentos.boletos.forEach((venc, idx) => {
        const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
        msgVencimentos += `${emoji} R$ ${formatarValor(venc.valor)} (${venc.dias_restantes} dias)\n`;
        msgVencimentos += `   📝 ${venc.descricao} | 📂 ${venc.categoria}\n\n`;
      });
      temVencimentos = true;
    }
    
    if (!temVencimentos) {
      msgVencimentos = `📅 Nenhum vencimento nos próximos ${dias} dias.`;
    } else if (dias === 30) {
      msgVencimentos += '💡 Use "vencimentos 7" para ver apenas os próximos 7 dias.';
    }
    
    await sock.sendMessage(userId, { text: msgVencimentos });
  } catch (error) {
    logger.error('Erro ao buscar vencimentos:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao buscar vencimentos.' });
  }
}

// Handler para comando categoria
async function handleCategoria(userId, sock, buscarGastosPorCategoria, categoria) {
  try {
    // Verificar se é uma categoria válida
    const categoriasValidas = ['alimentação', 'saúde', 'moradia', 'transporte', 'lazer', 'educação', 'trabalho', 'outros'];
    const categoriaNormalizada = categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (!categoriasValidas.some(cat => cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(categoriaNormalizada))) {
      await sock.sendMessage(userId, { 
        text: `❌ Categoria não reconhecida: "${categoria}"\n\nCategorias válidas:\n${categoriasValidas.map(cat => `• ${cat}`).join('\n')}` 
      });
      return;
    }
    
    const gastos = await buscarGastosPorCategoria(userId, categoria, 20);
    
    if (!gastos || gastos.length === 0) {
      await sock.sendMessage(userId, { text: `📂 Nenhum gasto encontrado na categoria "${categoria}".` });
      return;
    }
    
    let msgGastos = `📂 *Gastos - ${categoria.toUpperCase()}:*\n\n`;
    let totalCategoria = 0;
    
    gastos.forEach((gasto, idx) => {
      const dataBR = gasto.data instanceof Date 
        ? gasto.data.toLocaleDateString('pt-BR')
        : new Date(gasto.data).toLocaleDateString('pt-BR');
      
      msgGastos += `${idx + 1}. ${dataBR} | 💰 R$ ${formatarValor(gasto.valor)} | 💳 ${gasto.pagamento}\n`;
      msgGastos += `   📝 ${gasto.descricao}\n\n`;
      totalCategoria += gasto.valor;
    });
    
    msgGastos += `💰 *Total da categoria: R$ ${formatarValor(totalCategoria)}*\n`;
    msgGastos += `📊 ${gastos.length} lançamentos encontrados`;
    
    await sock.sendMessage(userId, { text: msgGastos });
  } catch (error) {
    logger.error('Erro ao buscar gastos por categoria:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao buscar gastos por categoria.' });
  }
}

// Handler para comando valor alto
async function handleValorAlto(userId, sock, buscarGastosValorAlto, valorMinimo = 100) {
  try {
    if (valorMinimo < 1) {
      await sock.sendMessage(userId, { text: '❌ Valor mínimo deve ser maior que zero.' });
      return;
    }
    
    const gastos = await buscarGastosValorAlto(userId, valorMinimo, 20);
    
    if (!gastos || gastos.length === 0) {
      await sock.sendMessage(userId, { text: `💰 Nenhum gasto encontrado acima de R$ ${formatarValor(valorMinimo)}.` });
      return;
    }
    
    let msgGastos = `💰 *Gastos Acima de R$ ${formatarValor(valorMinimo)}:*\n\n`;
    let totalAlto = 0;
    
    gastos.forEach((gasto, idx) => {
      const dataBR = gasto.data instanceof Date 
        ? gasto.data.toLocaleDateString('pt-BR')
        : new Date(gasto.data).toLocaleDateString('pt-BR');
      
      msgGastos += `${idx + 1}. ${dataBR} | 💰 R$ ${formatarValor(gasto.valor)} | 📂 ${gasto.categoria}\n`;
      msgGastos += `   📝 ${gasto.descricao} | 💳 ${gasto.pagamento}\n\n`;
      totalAlto += gasto.valor;
    });
    
    msgGastos += `💰 *Total: R$ ${formatarValor(totalAlto)}*\n`;
    msgGastos += `📊 ${gastos.length} lançamentos encontrados`;
    
    await sock.sendMessage(userId, { text: msgGastos });
  } catch (error) {
    logger.error('Erro ao buscar gastos com valor alto:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao buscar gastos com valor alto.' });
  }
}

module.exports = {
  handleParcelados,
  handleRecorrentes,
  handleVencimentos,
  handleCategoria,
  handleValorAlto
}; 