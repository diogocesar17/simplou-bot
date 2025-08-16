import * as usuariosService from '../services/usuariosService';

async function quemsouCommand(sock, userId) {
  // Buscar informações reais do usuário
  const acesso = await usuariosService.verificarAcessoUsuario(userId);
  let msg = `👤 *Informações do seu usuário:*\n\n`;
  msg += `• ID: ${userId}\n`;
  msg += `• Plano: ${acesso.plano || 'desconhecido'}\n`;
  msg += `• Admin: ${acesso.is_admin ? 'Sim' : 'Não'}\n`;
  msg += `• Status: ${acesso.acesso ? 'Ativo' : 'Bloqueado'}\n`;
  await sock.sendMessage(userId, { text: msg });
}

export default quemsouCommand;