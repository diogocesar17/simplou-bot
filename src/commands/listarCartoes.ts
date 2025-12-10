// @ts-nocheck
import * as cartoesService from '../services/cartoesService';
import { formatarMensagem, formatarLista, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function listarCartoesCommand(sock, userId) {
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum cartão configurado',
        emojiTitulo: '❌',
        dicas: gerarDicasContextuais('cartoes')
      })
    });
    return;
  }

  const itensCartoes = cartoes.map((cartao, idx) => {
    const fechamento = cartao.dia_fechamento ? `dia ${cartao.dia_fechamento}` : 'NÃO INFORMADO';
    return `${idx + 1}. *${cartao.nome_cartao}*\n   📅 Vencimento: dia ${cartao.dia_vencimento}\n   📋 Fechamento: ${fechamento}`;
  });

  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Cartões Configurados',
      emojiTitulo: '💳',
      secoes: [
        {
          titulo: 'Lista de Cartões',
          itens: itensCartoes,
          emoji: '📋'
        }
      ],
      dicas: gerarDicasContextuais('cartoes')
    })
  });

  // Guarda contexto leve de que a lista de cartões foi exibida,
  // permitindo que "editar <n>" direcione para edição de cartão.
  // TTL padrão (10min) conforme stateManager.
  try {
    const { definirEstado } = await import('../configs/stateManager');
    await definirEstado(userId, 'cartoes_listados', { cartoes });
  } catch (e) {
    // Fail-safe: se Redis não estiver disponível, apenas segue sem estado
    console.warn('[cartoes] Não foi possível definir estado cartoes_listados:', (e as any)?.message || e);
  }
}

export default listarCartoesCommand; 
