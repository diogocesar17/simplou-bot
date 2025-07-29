const { formatarValor } = require('../utils/formatUtils');
const lancamentosService = require('../services/lancamentosService');

async function categoriaCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^categoria\s+(.+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { text: '❌ Use: categoria [nome]. Exemplo: categoria lazer' });
    return;
  }
  const categoria = match[1].trim();
  const gastos = await lancamentosService.buscarGastosPorCategoria(userId, categoria, 20);
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
}

module.exports = categoriaCommand; 