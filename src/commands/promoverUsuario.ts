import * as usuariosService from '../services/usuariosService';
import { logger } from '../infrastructure/logger';

export async function promoverUsuarioCommand(sock: any, adminId: string, texto: string): Promise<void> {
  const isAdmin = await usuariosService.verificarAdmin(adminId);
  if (!isAdmin) {
    await sock.sendMessage(adminId, { text: '❌ Apenas administradores podem executar este comando.' });
    return;
  }

  // Formatos aceitos:
  //   promover <user_id>
  //   promover <user_id> <dias>
  const partes = texto.trim().split(/\s+/);
  // partes[0] = "promover", partes[1] = userId, partes[2] = dias (opcional)
  const alvoId = partes[1];

  if (!alvoId) {
    await sock.sendMessage(adminId, {
      text:
        '❌ Informe o ID do usuário.\n\n' +
        '*Uso:* promover <user_id> [dias]\n\n' +
        '• _promover 5561999887766@s.whatsapp.net_ — premium permanente\n' +
        '• _promover 5561999887766@s.whatsapp.net 30_ — premium por 30 dias\n\n' +
        'Para ver os IDs: *usuarios*',
    });
    return;
  }

  const dias = partes[2] ? parseInt(partes[2], 10) : null;
  if (partes[2] && (isNaN(dias!) || dias! <= 0)) {
    await sock.sendMessage(adminId, { text: '❌ Número de dias inválido. Use um número inteiro maior que zero.' });
    return;
  }

  try {
    const usuario = await usuariosService.buscarUsuario(alvoId);
    if (!usuario) {
      await sock.sendMessage(adminId, { text: `❌ Usuário não encontrado: \`${alvoId}\`` });
      return;
    }

    await usuariosService.promoverParaPremium(alvoId, dias, adminId);

    const prazo = dias ? `por *${dias} dias*` : '*permanente*';
    const nome = usuario.nome || 'Sem nome';
    logger.info({ alvoId, dias, adminId }, '[ADMIN] Usuário promovido a premium');

    await sock.sendMessage(adminId, {
      text:
        `✅ *Usuário promovido a Premium!*\n\n` +
        `👤 Nome: ${nome}\n` +
        `📱 ID: \`${alvoId}\`\n` +
        `⭐ Plano: Premium ${prazo}`,
    });
  } catch (err) {
    logger.error({ err }, '[ADMIN] Erro ao promover usuário');
    await sock.sendMessage(adminId, { text: '❌ Erro ao promover usuário. Verifique os logs.' });
  }
}
