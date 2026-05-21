import * as usuariosService from '../services/usuariosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function meuidCommand(sock, userId) {
  const isAdmin = await usuariosService.verificarAdmin(userId);
  if (!isAdmin) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.SEM_PERMISSAO('Ver ID', 'Apenas administradores podem executar este comando')
    });
    return;
  }

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