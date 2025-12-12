// @ts-nocheck
// Comando para verificar status de usuário específico (apenas para admins)
import * as usuariosService from '../services/usuariosService';

async function statusUsuarioCommand(sock, userId, texto) {
  try {
    // Verificar se o usuário é admin
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, { 
        text: '❌ Acesso negado. Apenas administradores podem verificar status de usuários.' 
      });
      return;
    }

    // Processar comando de status
    const resultado = await usuariosService.processarComandoStatus(texto);
    
    // Enviar resposta
    await sock.sendMessage(userId, { text: resultado.message });
    
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro no comando statusUsuario');
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de status.' 
    });
  }
}

export default statusUsuarioCommand; 
import { logger } from '../infrastructure/logger';
