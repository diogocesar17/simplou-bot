// Comando para cadastrar usuário (apenas para admins)
const usuariosService = require('../services/usuariosService');

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
    const resultado = await usuariosService.processarComandoCadastrar(texto, userId);
    
    // Enviar resposta
    await sock.sendMessage(userId, { text: resultado.message });
    
    // Se cadastrado com sucesso, enviar mensagem de boas-vindas para o novo usuário
    if (resultado.success && resultado.usuario) {
      const mensagemBoasVindas = usuariosService.gerarMensagemBoasVindas(resultado.usuario);
      await sock.sendMessage(resultado.usuario.user_id, { text: mensagemBoasVindas });
    }
    
  } catch (error) {
    console.error('Erro no comando cadastrarUsuario:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de cadastro.' 
    });
  }
}

module.exports = cadastrarUsuarioCommand; 