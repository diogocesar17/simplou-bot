import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { definirEstado } from '../configs/stateManager';

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
  
  // Guarda contexto para permitir atalho "excluir <número>" direto desta tela
  await definirEstado(userId, 'recorrentes_listados', { recorrentes, timestamp: Date.now() });

  const itensRecorrentes = recorrentes.map((recorrente, idx) => {
    let item = `${idx + 1}. *${recorrente.descricao}*\n   💰 R$ ${formatarValor(recorrente.valor)}/mês · ${recorrente.total_recorrencias} meses registrados\n   📅 ${recorrente.primeira_recorrencia} a ${recorrente.ultima_recorrencia}\n   📂 ${recorrente.categoria} | 💳 ${recorrente.pagamento}`;
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
        },
        {
          titulo: 'Como editar/excluir',
          itens: [
            '1. Para editar: envie "editar <número>" diretamente aqui',
            '2. Para excluir: envie "excluir <número>" diretamente aqui'
          ],
          emoji: '💡'
        }
      ],
      dicas: [
        { texto: 'Ver histórico', comando: 'historico' },
        { texto: 'Ver ajuda', comando: 'ajuda' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      ]
    })
  });
}

export default recorrentesCommand; 
