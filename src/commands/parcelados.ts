// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';

async function parceladosCommand(sock, userId) {
  const parcelados = await lancamentosService.buscarParceladosAtivos(userId, 20);
  
  if (!parcelados || parcelados.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum parcelamento ativo encontrado',
        emojiTitulo: '📦',
        dicas: [
          { texto: 'Ver histórico de lançamentos', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' }
        ]
      })
    });
    return;
  }
  
  const itensParcelados = parcelados.map((parcelamento, idx) => {
    const parcelasPagas = parcelamento.parcelas.filter(p => p.status === 'paga').length;
    const parcelasPendentes = parcelamento.total_parcelas - parcelasPagas;
    return `${idx + 1}. *${parcelamento.descricao}*\n   💰 Total: R$ ${formatarValor(parcelamento.valor_total)}\n   📦 ${parcelamento.total_parcelas}x de R$ ${formatarValor(parcelamento.valor_parcela)}\n   ✅ Pagas: ${parcelasPagas} | ⏳ Pendentes: ${parcelasPendentes}\n   📂 ${parcelamento.categoria} | 💳 ${parcelamento.pagamento}\n   📅 ${parcelamento.primeira_parcela} a ${parcelamento.ultima_parcela}`;
  });

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Parcelamentos Ativos',
      emojiTitulo: '📦',
      secoes: [
        {
          titulo: 'Parcelamentos',
          itens: itensParcelados,
          emoji: '📊'
        }
      ],
      dicas: [
        { texto: 'Excluir parcelamento', comando: 'excluir <número>' },
        { texto: 'Ver histórico detalhado', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      ]
    })
  });
}

export default parceladosCommand; 