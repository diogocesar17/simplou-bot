// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';

async function recorrentesCommand(sock, userId) {
  const recorrentes = await lancamentosService.buscarRecorrentesAtivos(userId, 20);
  
  if (!recorrentes || recorrentes.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum gasto recorrente/fixo encontrado',
        emojiTitulo: '🔄',
        dicas: [
          { texto: 'Ver histórico de lançamentos', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' }
        ]
      })
    });
    return;
  }
  
  const itensRecorrentes = recorrentes.map((recorrente, idx) => {
    const recorrenciasPagas = recorrente.recorrencias.filter(r => r.status === 'paga').length;
    const recorrenciasPendentes = recorrente.total_recorrencias - recorrenciasPagas;
    let item = `${idx + 1}. *${recorrente.descricao}*\n   💰 Valor: R$ ${formatarValor(recorrente.valor)}\n   🔄 ${recorrente.total_recorrencias} meses\n   ✅ Pagas: ${recorrenciasPagas} | ⏳ Pendentes: ${recorrenciasPendentes}\n   📂 ${recorrente.categoria} | 💳 ${recorrente.pagamento}\n   📅 ${recorrente.primeira_recorrencia} a ${recorrente.ultima_recorrencia}`;
    if (recorrente.recorrente_fim) {
      item += `\n   🛑 Fim: ${recorrente.recorrente_fim}`;
    }
    return item;
  });

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Gastos Recorrentes/Fixos',
      emojiTitulo: '🔄',
      secoes: [
        {
          titulo: 'Recorrentes',
          itens: itensRecorrentes,
          emoji: '📊'
        }
      ],
      dicas: [
        { texto: 'Excluir recorrente', comando: 'excluir <número>' },
        { texto: 'Ver histórico detalhado', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      ]
    })
  });
}

export default recorrentesCommand; 