import * as usuariosService from '../services/usuariosService';
import { SYSTEM_CONFIG } from '../config/config';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function statusCommand(sock, userId) {
  const isAdmin = await usuariosService.verificarAdmin(userId);
  if (!isAdmin) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.SEM_PERMISSAO('Ver status', 'Apenas administradores podem executar este comando')
    });
    return;
  }

  const usuarios = await usuariosService.listarUsuarios();
  const totalUsuarios = usuarios.length;
  const totalAdmins = usuarios.filter(u => u.is_admin).length;
  const totalPremium = usuarios.filter(u => u.plano === 'premium').length;

  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Status do Sistema',
      emojiTitulo: '📊',
      secoes: [
        {
          titulo: 'Estatísticas Gerais',
          itens: [
            `Usuários: ${totalUsuarios}`,
            `Admins: ${totalAdmins}`,
            `Premium: ${totalPremium}`,
            `Versão: ${SYSTEM_CONFIG?.VERSION || '1.0.0'}`,
            `Última verificação: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
          ],
          emoji: '📈'
        }
      ]
    })
  });
}

export default statusCommand;
