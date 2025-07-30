// @ts-nocheck
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
    const resultado = await usuariosService.processarComandoPremium(texto, userId);
    
    // Enviar resposta
    await sock.sendMessage(userId, { text: resultado.message });
    
    // Se promovido com sucesso, enviar mensagem para o usuário
    if (resultado.success && resultado.usuario) {
      const mensagemPromocao = usuariosService.gerarMensagemPromocaoPremium(resultado.usuario, resultado.usuario.data_expiracao_premium ? 30 : null);
      await sock.sendMessage(resultado.usuario.user_id, { text: mensagemPromocao });
    }
    
  } catch (error) {
    console.error('Erro no comando promoverPremium:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao processar comando de promoção.' 
    });
  }
}

export default promoverPremiumCommand; 