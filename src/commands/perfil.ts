import * as usuariosService from '../services/usuariosService';

async function perfilCommand(sock: any, userId: string) {
  const usuario = await usuariosService.buscarUsuario(userId);

  let msg = `👤 *Seu Perfil*\n\n`;
  msg += `📱 *ID WhatsApp:* \`${userId}\`\n`;

  if (usuario) {
    msg += `👤 *Nome:* ${usuario.nome || 'Não informado'}\n`;

    const planoLabel = usuario.plano === 'premium' ? '👑 Premium' : '📱 Gratuito';
    msg += `📊 *Plano:* ${planoLabel}\n`;

    if (usuario.plano === 'premium' && usuario.data_expiracao_premium) {
      const expiracao = new Date(usuario.data_expiracao_premium);
      msg += `⏰ *Expira em:* ${expiracao.toLocaleDateString('pt-BR')}\n`;
    }

    if (usuario.data_cadastro || usuario.criado_em) {
      const dataCadastro = new Date(usuario.data_cadastro || usuario.criado_em);
      msg += `📅 *Cadastrado em:* ${dataCadastro.toLocaleDateString('pt-BR')}\n`;
    }
  } else {
    msg += `⚠️ Usuário não encontrado no sistema.\n`;
  }

  msg += `\n💡 Para ver ajuda completa, digite *ajuda*`;

  await sock.sendMessage(userId, { text: msg });
}

export default perfilCommand;
