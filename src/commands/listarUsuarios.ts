// @ts-nocheck
// Comando para listar usuários (apenas para admins)
import * as usuariosService from '../services/usuariosService';

async function listarUsuariosCommand(sock, userId, texto) {
  try {
    // Verificar se o usuário é admin
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, { 
        text: '❌ Acesso negado. Apenas administradores podem listar usuários.' 
      });
      return;
    }

    // Processar comando de listagem
    const resultado = await usuariosService.processarComandoUsuarios();
    
    // Enviar resposta
    await sock.sendMessage(userId, { text: resultado.message });
    
  } catch (error) {
    console.error('Erro no comando listarUsuarios:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de listagem.' 
    });
  }
}

export default listarUsuariosCommand; 