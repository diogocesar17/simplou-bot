// @ts-nocheck
// Comando para remover usuário (apenas para admins)
import * as usuariosService from '../services/usuariosService';

async function removerUsuarioCommand(sock, userId, texto) {
  try {
    // Verificar se o usuário é admin
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, { 
        text: '❌ Acesso negado. Apenas administradores podem remover usuários.' 
      });
      return;
    }

    // Processar comando de remoção
    const resultado = await usuariosService.processarComandoRemover(texto, userId);
    
    // Enviar resposta
    await sock.sendMessage(userId, { text: resultado.message });
    
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro no comando removerUsuario');
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de remoção.' 
    });
  }
}

export default removerUsuarioCommand; 
import { logger } from '../infrastructure/logger';
