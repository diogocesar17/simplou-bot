// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function faturaCommand(sock, userId, texto) {
  const partes = texto.toLowerCase().split(' ');
  if (partes.length < 3) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.FORMATO_INVALIDO('Comando fatura', 'fatura nubank 07/2025', 'fatura nubank 07/2025, fatura itau 12/2024') 
    });
    return;
  }
  const nomeCartao = partes[1];
  const mesAno = partes.slice(2).join(' ');
  const parsed = parseMesAno(mesAno);
  if (!parsed) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.FORMATO_INVALIDO('Mês/ano', '07/2025', 'fatura nubank 07/2025, fatura itau 12/2024') 
    });
    return;
  }
  const { mes, ano } = parsed;
  const fatura = await lancamentosService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
  const nomeMesFatura = getNomeMes(mes - 1);
  
  if (!fatura || fatura.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum lançamento encontrado',
        emojiTitulo: '📭',
        secoes: [
          {
            titulo: 'Detalhes',
            itens: [
              `Cartão: ${nomeCartao}`,
              `Período: ${nomeMesFatura}/${ano}`
            ],
            emoji: '💳'
          }
        ],
        dicas: [
          { texto: 'Verificar nome do cartão', comando: 'cartoes' },
          { texto: 'Ver histórico geral', comando: 'historico' }
        ]
      })
    });
    return;
  }
  
  let total = 0;
  const itensFatura = fatura.map(l => {
    const dataBR = (l.data_lancamento instanceof Date)
      ? l.data_lancamento.toLocaleDateString('pt-BR')
      : (typeof l.data_lancamento === 'string' && l.data_lancamento.match(/\d{4}-\d{2}-\d{2}/)
          ? new Date(l.data_lancamento).toLocaleDateString('pt-BR')
          : l.data_lancamento);
    total += parseFloat(l.valor);
    return `${dataBR} - ${l.descricao} - R$ ${formatarValor(l.valor)}`;
  });

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: `Fatura ${nomeCartao} ${nomeMesFatura}/${ano}`,
      emojiTitulo: '💳',
      secoes: [
        {
          titulo: 'Lançamentos',
          itens: itensFatura,
          emoji: '📊'
        },
        {
          titulo: 'Resumo',
          itens: [`Total: R$ ${formatarValor(total)}`],
          emoji: '💰'
        }
      ],
      dicas: [
        { texto: 'Ver fatura de outro mês', comando: 'fatura nubank 08/2024' },
        { texto: 'Ver histórico geral', comando: 'historico' }
      ]
    })
  });
}

export default faturaCommand; 