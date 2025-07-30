// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';

async function recorrentesCommand(sock, userId) {
  const recorrentes = await lancamentosService.buscarRecorrentesAtivos(userId, 20);
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
}

export default recorrentesCommand; 