// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function categoriaCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^categoria\s+(.+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.FORMATO_INVALIDO('Comando categoria', 'categoria lazer', 'categoria mercado, categoria lazer, categoria transporte') 
    });
    return;
  }
  const categoria = match[1].trim();
  const gastos = await lancamentosService.buscarGastosPorCategoria(userId, categoria, 20);
  
  if (!gastos || gastos.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum gasto encontrado',
        emojiTitulo: '📂',
        secoes: [
          {
            titulo: 'Detalhes',
            itens: [`Categoria: ${categoria}`],
            emoji: '🏷️'
          }
        ],
        dicas: [
          { texto: 'Ver histórico geral', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' }
        ]
      })
    });
    return;
  }
  
  let totalCategoria = 0;
  const itensGastos = gastos.map((gasto, idx) => {
    const dataBR = gasto.data instanceof Date 
      ? gasto.data.toLocaleDateString('pt-BR')
      : new Date(gasto.data).toLocaleDateString('pt-BR');
    totalCategoria += gasto.valor;
    return `${idx + 1}. ${dataBR} | 💰 R$ ${formatarValor(gasto.valor)} | 💳 ${gasto.pagamento}\n   📝 ${gasto.descricao}`;
  });

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: `Gastos - ${categoria.toUpperCase()}`,
      emojiTitulo: '📂',
      secoes: [
        {
          titulo: 'Lançamentos',
          itens: itensGastos,
          emoji: '📊'
        },
        {
          titulo: 'Resumo',
          itens: [
            `Total: R$ ${formatarValor(totalCategoria)}`,
            `${gastos.length} lançamentos encontrados`
          ],
          emoji: '💰'
        }
      ],
      dicas: [
        { texto: 'Ver outra categoria', comando: 'categoria mercado' },
        { texto: 'Ver histórico geral', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      ]
    })
  });
}

export default categoriaCommand; 