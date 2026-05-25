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
    return `${idx + 1}. *${parcelamento.descricao}*\n   💰 Total: R$ ${formatarValor(parcelamento.valor_total)} · ${parcelamento.total_parcelas}x de R$ ${formatarValor(parcelamento.valor_parcela)}\n   📅 ${parcelamento.primeira_parcela} a ${parcelamento.ultima_parcela}\n   📂 ${parcelamento.categoria} | 💳 ${parcelamento.pagamento}`;
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