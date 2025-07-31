// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';

async function parceladosCommand(sock, userId) {
  const parcelados = await lancamentosService.buscarParceladosAtivos(userId, 20);
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
}

export default parceladosCommand; 