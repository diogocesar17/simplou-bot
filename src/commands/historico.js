const { formatarValor } = require('../utils/formatUtils');
const { parseMesAno, getNomeMes } = require('../utils/dataUtils');
const lancamentosService = require('../services/lancamentosService');

async function historicoCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  // Extrai o possível período após o comando
  const partes = texto.trim().split(/\s+/);
  let mesAno = null;
  let limite = 10; // padrão
  if (partes.length > 1) {
    const resto = partes.slice(1).join(' ');
    mesAno = parseMesAno(resto);
    if (mesAno) limite = 20;
  }
  let ultimos;
  if (mesAno) {
    ultimos = await lancamentosService.listarLancamentos(userId, limite, mesAno.mes, mesAno.ano);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}.` });
      return;
    }
  } else {
    ultimos = await lancamentosService.listarLancamentos(userId, limite);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, { text: 'Nenhum lançamento encontrado.' });
      return;
    }
  }
  let msgHist = mesAno 
    ? `📋 *Histórico ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}:*\n`
    : '📋 *Últimos lançamentos:*\n';
  ultimos.forEach((l, idx) => {
    const dataBR = (l.data instanceof Date)
      ? l.data.toLocaleDateString('pt-BR')
      : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
          ? new Date(l.data).toLocaleDateString('pt-BR')
          : l.data);
    msgHist += `${idx + 1}. ️${dataBR} | 💰 R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
    if (l.tipoAgrupamento === 'parcelado') {
      msgHist += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo && l.grupo[0] ? l.grupo[0].valor : 0)}`;
    }
    if (l.tipoAgrupamento === 'recorrente') {
      msgHist += ` | 🔁 Recorrente: ${l.grupo ? l.grupo.length : 0}x`;
    }
    if (l.descricao) msgHist += ` | 📝 ${l.descricao}`;
    msgHist += '\n';
  });
  let msgFinal = msgHist + '\nPara editar, envie: Editar <número>';
  if (!mesAno) {
    msgFinal += '\n\n💡 *Dica:* Para ver todos os lançamentos de um mês específico, envie:\n"Histórico [mês] [ano]" (ex: "Histórico julho 2025")';
  }
  await sock.sendMessage(userId, { text: msgFinal });
}

module.exports = historicoCommand; 