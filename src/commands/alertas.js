const alertasService = require('../services/alertasService');
const { logger } = require('../../logger');

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
        text: `✅ *Nenhum alerta encontrado!*\n\n` +
              `🎉 Você está em dia com seus compromissos.\n` +
              `💡 Os alertas são verificados automaticamente todos os dias.`
      });
      return;
    }
    
    // Buscar todos os alertas
    const mensagemAlertas = await alertasService.buscarTodosAlertas(userId);
    
    if (mensagemAlertas) {
      await sock.sendMessage(userId, {
        text: mensagemAlertas + `\n\n💡 *Dica:* Use "vencimentos" para ver todos os próximos vencimentos.`
      });
    } else {
      await sock.sendMessage(userId, {
        text: `❌ Erro ao buscar alertas. Tente novamente.`
      });
    }
    
  } catch (error) {
    logger.error('Erro no comando de alertas:', error);
    await sock.sendMessage(userId, {
      text: `❌ Erro interno. Tente novamente.`
    });
  }
}

module.exports = alertasCommand; 