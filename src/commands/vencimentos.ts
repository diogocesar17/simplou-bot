// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function vencimentosCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^vencimentos\s*(\d+)?$/i);
  const dias = match && match[1] ? parseInt(match[1]) : 30;
  if (dias < 1 || dias > 365) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.VALOR_INVALIDO('Período', 'Entre 1 e 365 dias', 'vencimentos 7, vencimentos 30, vencimentos 90') 
    });
    return;
  }
  const vencimentos = await lancamentosService.buscarProximosVencimentos(userId, dias);
  
  if ((!vencimentos.cartoes || vencimentos.cartoes.length === 0) && 
      (!vencimentos.boletos || vencimentos.boletos.length === 0)) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum vencimento encontrado',
        emojiTitulo: '📅',
        secoes: [
          {
            titulo: 'Período',
            itens: [`Próximos ${dias} dias`],
            emoji: '⏰'
          }
        ],
        dicas: [
          { texto: 'Ver histórico de lançamentos', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' }
        ]
      })
    });
    return;
  }

  const secoes = [];
  
  // Cartões
  if (vencimentos.cartoes && vencimentos.cartoes.length > 0) {
    const itensCartoes = vencimentos.cartoes.map((venc) => {
      const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
      return `${emoji} ${venc.cartao_nome}: R$ ${formatarValor(venc.valor)} (${venc.dias_restantes} dias)\n   📝 ${venc.descricao} | 📂 ${venc.categoria}`;
    });
    secoes.push({
      titulo: 'Faturas de Cartão',
      itens: itensCartoes,
      emoji: '💳'
    });
  }
  
  // Boletos
  if (vencimentos.boletos && vencimentos.boletos.length > 0) {
    const itensBoletos = vencimentos.boletos.map((venc) => {
      const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
      return `${emoji} R$ ${formatarValor(venc.valor)} (${venc.dias_restantes} dias)\n   📝 ${venc.descricao} | 📂 ${venc.categoria}`;
    });
    secoes.push({
      titulo: 'Boletos',
      itens: itensBoletos,
      emoji: '📄'
    });
  }

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: `Próximos Vencimentos (${dias} dias)`,
      emojiTitulo: '📅',
      secoes: secoes,
      dicas: [
        { texto: 'Ver vencimentos em 7 dias', comando: 'vencimentos 7' },
        { texto: 'Ver vencimentos em 90 dias', comando: 'vencimentos 90' },
        { texto: 'Ver histórico geral', comando: 'historico' }
      ]
    })
  });
}

export default vencimentosCommand; 