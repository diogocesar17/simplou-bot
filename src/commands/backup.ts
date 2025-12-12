// @ts-nocheck
import * as sistemaService from '../services/sistemaService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function backupCommand(sock, userId) {
  try {
    const resultado = await sistemaService.gerarBackupCSV(userId);
    
    if (resultado && resultado.sucesso) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Backup gerado com sucesso',
          emojiTitulo: '💾',
          secoes: [
            {
              titulo: 'Detalhes do Arquivo',
              itens: [
                `Arquivo: ${resultado.nomeArquivo}`,
                `Lançamentos: ${resultado.totalLancamentos}`,
                `Período: ${resultado.periodo}`,
                `Tamanho: ${resultado.tamanho} KB`
              ],
              emoji: '📁'
            },
            {
              titulo: 'Localização',
              itens: [`${resultado.caminhoArquivo}`],
              emoji: '📥'
            }
          ],
          dicas: [
            { texto: 'Ver status do sistema', comando: 'status' },
            { texto: 'Ver logs do sistema', comando: 'logs' }
          ],
          ajuda: 'O arquivo foi salvo no servidor. Você pode acessá-lo via FTP ou solicitar ao administrador'
        })
      });
    } else {
      const erroMsg = resultado?.erro || 'Erro desconhecido';
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.ERRO_BANCO('Gerar backup', erroMsg)
      });
    }
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro ao gerar backup');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.ERRO_INTERNO('Gerar backup', 'Tente novamente em alguns instantes')
    });
  }
}

export default backupCommand; 
import { logger } from '../infrastructure/logger';
