// Comando para cadastrar usuário (apenas para admins)
import * as usuariosService from '../services/usuariosService';

async function cadastrarUsuarioCommand(sock, userId, texto) {
  try {
    // Verificar se o usuário é admin
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, { 
        text: '❌ Acesso negado. Apenas administradores podem cadastrar usuários.' 
      });
      return;
    }

    // Processar comando de cadastro
    await sock.sendMessage(userId, {
      text: 'Funcionalidade não disponível nesta versão.'
    });
    
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro no comando cadastrarUsuario');
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de cadastro.' 
    });
  }
}

export default cadastrarUsuarioCommand; 
import { logger } from '../infrastructure/logger';
