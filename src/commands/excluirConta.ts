import * as usuariosService from '../services/usuariosService';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { logger } from '../infrastructure/logger';

export async function excluirContaCommand(sock: any, userId: string): Promise<void> {
  const usuario = await usuariosService.buscarUsuario(userId);
  if (!usuario) {
    await sock.sendMessage(userId, { text: '❌ Usuário não encontrado.' });
    return;
  }

  await definirEstado(userId, 'confirmando_exclusao_conta', {});
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '⚠️ Excluir minha conta',
    body:
      'Isso irá apagar *permanentemente*:\n\n' +
      '• Todos os seus lançamentos\n' +
      '• Seus cartões configurados\n' +
      '• Seus lembretes\n' +
      '• Suas metas e perfil\n' +
      '• Suas preferências\n\n' +
      'Essa ação *não pode ser desfeita*. Tem certeza?',
    buttons: [
      { id: 'confirmar_exclusao', title: '🗑️ Sim, excluir tudo' },
      { id: 'cancelar_exclusao', title: '❌ Cancelar' },
    ],
  });
}

export async function handleConfirmacaoExclusaoConta(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().trim();

  if (norm === 'cancelar_exclusao' || norm === 'cancelar') {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '↩️ Exclusão cancelada. Seus dados continuam intactos.' });
    return;
  }

  if (norm === 'confirmar_exclusao' || norm === 'sim' || norm === 'confirmar') {
    try {
      await usuariosService.removerUsuario(userId, userId);
      await limparEstado(userId);
      logger.info({ userId }, '[CONTA] Usuário excluiu própria conta');
      await sock.sendMessage(userId, {
        text:
          '✅ Sua conta foi excluída com sucesso.\n\n' +
          'Todos os seus dados foram removidos permanentemente.\n\n' +
          'Se quiser usar o Simplou novamente no futuro, é só mandar uma mensagem e criamos uma nova conta. 👋',
      });
    } catch (err) {
      logger.error({ err }, '[CONTA] Erro ao excluir conta do usuário');
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Erro ao excluir conta. Tente novamente ou entre em contato: contato@simplou.com' });
    }
    return;
  }

  // Resposta não reconhecida — repete a confirmação
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '⚠️ Confirme a exclusão',
    body: 'Toque em um dos botões abaixo para continuar:',
    buttons: [
      { id: 'confirmar_exclusao', title: '🗑️ Sim, excluir tudo' },
      { id: 'cancelar_exclusao', title: '❌ Cancelar' },
    ],
  });
}
