// @ts-nocheck
import * as alertasService from '../services/alertasService';
import { logger } from '../infrastructure/logger';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

/**
 * Comando para verificar alertas do usuário
 * @param {object} sock - Socket do WhatsApp
 * @param {string} userId - ID do usuário
 */
async function alertasCommand(sock, userId) {
  try {
    logger.info(`Verificando alertas para usuário: ${userId}`);
    
    // Verificar se há alertas
    const temAlertas = await alertasService.temAlertas(userId);
    
    if (!temAlertas) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Nenhum alerta encontrado',
          emojiTitulo: '✅',
          secoes: [
            {
              titulo: 'Status',
              itens: ['Você está em dia com seus compromissos'],
              emoji: '🎉'
            }
          ],
          dicas: [
            { texto: 'Ver próximos vencimentos', comando: 'vencimentos' },
            { texto: 'Ver histórico geral', comando: 'historico' }
          ],
          ajuda: 'Os alertas são verificados automaticamente todos os dias'
        })
      });
      return;
    }
    
    // Buscar todos os alertas
    const mensagemAlertas = await alertasService.buscarTodosAlertas(userId);
    
    if (mensagemAlertas) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Alertas Encontrados',
          emojiTitulo: '🚨',
          secoes: [
            {
              titulo: 'Alertas',
              itens: [mensagemAlertas],
              emoji: '⚠️'
            }
          ],
          dicas: [
            { texto: 'Ver próximos vencimentos', comando: 'vencimentos' },
            { texto: 'Ver histórico geral', comando: 'historico' }
          ]
        })
      });
    } else {
      await sock.sendMessage(userId, {
        text: ERROR_MESSAGES.ERRO_BANCO('Buscar alertas', 'Tente novamente em alguns instantes')
      });
    }
    
  } catch (error) {
    logger.error('Erro no comando de alertas:', error);
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.ERRO_INTERNO('Verificar alertas', 'Tente novamente em alguns instantes')
    });
  }
}

export default alertasCommand; 
