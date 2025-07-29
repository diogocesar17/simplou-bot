const { formatarValor } = require('../utils/formatUtils');
const { parseMesAno, getNomeMes } = require('../utils/dataUtils');
const lancamentosService = require('../services/lancamentosService');

async function faturaCommand(sock, userId, texto) {
  const partes = texto.toLowerCase().split(' ');
  if (partes.length < 3) {
    await sock.sendMessage(userId, { text: '❌ Use: fatura [cartão] [mês/ano]. Exemplo: fatura nubank 07/2025' });
    return;
  }
  const nomeCartao = partes[1];
  const mesAno = partes.slice(2).join(' ');
  const parsed = parseMesAno(mesAno);
  if (!parsed) {
    await sock.sendMessage(userId, { text: '❌ Mês/ano inválido. Exemplo: fatura nubank 07/2025' });
    return;
  }
  const { mes, ano } = parsed;
  const fatura = await lancamentosService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
  const nomeMesFatura = getNomeMes(mes - 1);
  if (!fatura || fatura.length === 0) {
    await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para o cartão ${nomeCartao} em ${nomeMesFatura}/${ano}.` });
    return;
  }
  let total = 0;
  let msgFatura = `💳 *Fatura ${nomeCartao} ${nomeMesFatura}/${ano}*\n`;
  fatura.forEach(l => {
    const dataBR = (l.data_lancamento instanceof Date)
      ? l.data_lancamento.toLocaleDateString('pt-BR')
      : (typeof l.data_lancamento === 'string' && l.data_lancamento.match(/\d{4}-\d{2}-\d{2}/)
          ? new Date(l.data_lancamento).toLocaleDateString('pt-BR')
          : l.data_lancamento);
    msgFatura += `• ${dataBR} - ${l.descricao} - R$ ${formatarValor(l.valor)}\n`;
    total += parseFloat(l.valor);
  });
  msgFatura += `\nTotal: R$ ${formatarValor(total)}`;
  await sock.sendMessage(userId, { text: msgFatura });
}

module.exports = faturaCommand; 