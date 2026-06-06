import * as usuariosService from '../services/usuariosService';
import { runBackupNow } from '../infrastructure/backupScheduler';
import { logger } from '../infrastructure/logger';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function backupCommand(sock: any, userId: string): Promise<void> {
  try {
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, {
        text: ERROR_MESSAGES.SEM_PERMISSAO('Gerar backup', 'Apenas administradores podem executar este comando'),
      });
      return;
    }

    await sock.sendMessage(userId, { text: '⏳ Executando pg_dump... aguarde.' });

    const resultado = await runBackupNow();

    if (resultado.ok) {
      await sock.sendMessage(userId, {
        text:
          '💾 *Backup concluído*\n\n' +
          `📁 Arquivo: \`${resultado.file}\`\n` +
          `📦 Tamanho: ${resultado.sizeKb} KB\n` +
          `🗂️ Total armazenado: ${resultado.totalArquivos} backup(s)\n` +
          `🗓️ Retenção: 30 dias\n\n` +
          '_Arquivos em `backups/` no servidor_',
      });
    } else {
      logger.error({ err: resultado.error }, '[BACKUP] Falha no backup manual');
      await sock.sendMessage(userId, {
        text: `❌ Falha no backup\n\n\`${resultado.error}\``,
      });
    }
  } catch (error: any) {
    logger.error({ err: error?.message || error }, '[BACKUP] Erro inesperado no comando backup');
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.ERRO_INTERNO('Gerar backup', 'Tente novamente em alguns instantes'),
    });
  }
}

export default backupCommand;
