const { formatarValor } = require('../utils/formatUtils');
const lancamentosService = require('../services/lancamentosService');

async function valorAltoCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^valor alto\s*(\d*)$/i);
  const valorMinimo = match && match[1] ? parseInt(match[1]) : 100;
  if (valorMinimo < 1) {
    await sock.sendMessage(userId, { text: '❌ Valor mínimo deve ser maior que zero.' });
    return;
  }
  const gastos = await lancamentosService.buscarGastosValorAlto(userId, valorMinimo, 20);
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
}

module.exports = valorAltoCommand; 