// Comando para promover usuário para premium (apenas para admins)
import * as usuariosService from '../services/usuariosService';

async function promoverPremiumCommand(sock, userId, texto) {
  try {
    // Verificar se o usuário é admin
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, { 
        text: '❌ Acesso negado. Apenas administradores podem promover usuários.' 
      });
      return;
    }

    // Processar comando de promoção
    await sock.sendMessage(userId, {
      text: 'Funcionalidade não disponível nesta versão.'
    });
    
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro no comando promoverPremium');
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de promoção.' 
    });
  }
}

export default promoverPremiumCommand; 
import { logger } from '../infrastructure/logger';
