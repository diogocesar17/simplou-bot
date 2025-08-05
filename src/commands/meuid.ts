// @ts-nocheck
import { formatarMensagem } from '../utils/formatMessages';

async function meuidCommand(sock, userId) {
  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Seu ID do WhatsApp',
      emojiTitulo: '🆔',
      secoes: [{
        titulo: 'Identificação',
        itens: [`ID: ${userId}`],
        emoji: '📱'
      }],
      dicas: [
        { texto: 'Use este ID para configurações', comando: 'configurar' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      ]
    })
  });
}

export default meuidCommand; 