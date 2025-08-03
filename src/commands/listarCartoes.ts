// @ts-nocheck
import * as cartoesService from '../services/cartoesService';
import { formatarMensagem, formatarLista } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function listarCartoesCommand(sock, userId) {
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum cartão configurado',
        emojiTitulo: '❌',
        dicas: [
          { texto: 'Configure seu primeiro cartão', comando: 'configurar cartão' }
        ]
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
      dicas: [
        { texto: 'Editar vencimento ou fechamento', comando: 'editar cartão' },
        { texto: 'Configurar novo cartão', comando: 'configurar cartão' }
      ]
    })
  });
}

export default listarCartoesCommand; 