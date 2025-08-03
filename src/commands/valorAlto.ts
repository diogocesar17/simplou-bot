// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function valorAltoCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^valor alto\s*(\d*)$/i);
  const valorMinimo = match && match[1] ? parseInt(match[1]) : 100;
  if (valorMinimo < 1) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.VALOR_INVALIDO('Valor mínimo', 'Maior que zero', 'valor alto 200, valor alto 500') 
    });
    return;
  }
  const gastos = await lancamentosService.buscarGastosValorAlto(userId, valorMinimo, 20);
  
  if (!gastos || gastos.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum gasto encontrado',
        emojiTitulo: '💰',
        secoes: [
          {
            titulo: 'Filtro',
            itens: [`Acima de R$ ${formatarValor(valorMinimo)}`],
            emoji: '🔍'
          }
        ],
        dicas: [
          { texto: 'Tentar valor menor', comando: 'valor alto 50' },
          { texto: 'Ver histórico geral', comando: 'historico' }
        ]
      })
    });
    return;
  }
  
  let totalAlto = 0;
  const itensGastos = gastos.map((gasto, idx) => {
    const dataBR = gasto.data instanceof Date 
      ? gasto.data.toLocaleDateString('pt-BR')
      : new Date(gasto.data).toLocaleDateString('pt-BR');
    totalAlto += gasto.valor;
    return `${idx + 1}. ${dataBR} | 💰 R$ ${formatarValor(gasto.valor)} | 📂 ${gasto.categoria}\n   📝 ${gasto.descricao} | 💳 ${gasto.pagamento}`;
  });

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: `Gastos Acima de R$ ${formatarValor(valorMinimo)}`,
      emojiTitulo: '💰',
      secoes: [
        {
          titulo: 'Lançamentos',
          itens: itensGastos,
          emoji: '📊'
        },
        {
          titulo: 'Resumo',
          itens: [
            `Total: R$ ${formatarValor(totalAlto)}`,
            `${gastos.length} lançamentos encontrados`
          ],
          emoji: '📈'
        }
      ],
      dicas: [
        { texto: 'Ver gastos acima de R$ 200', comando: 'valor alto 200' },
        { texto: 'Ver gastos acima de R$ 500', comando: 'valor alto 500' },
        { texto: 'Ver histórico geral', comando: 'historico' }
      ]
    })
  });
}

export default valorAltoCommand; 