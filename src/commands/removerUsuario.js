// Comando para remover usuário (apenas para admins)
const usuariosService = require('../services/usuariosService');

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
    console.error('Erro no comando removerUsuario:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de remoção.' 
    });
  }
}

module.exports = removerUsuarioCommand; 