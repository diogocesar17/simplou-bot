// @ts-nocheck
import * as sistemaService from '../services/sistemaService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function logsCommand(sock, userId) {
  try {
    // Gerar logs de auditoria em CSV
    const resultado = await sistemaService.gerarLogAuditoria(userId, 'recentes');
    
    if (resultado && resultado.sucesso) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Logs de Auditoria gerados com sucesso',
          emojiTitulo: '📄',
          secoes: [
            {
              titulo: 'Detalhes do Arquivo',
              itens: [
                `Arquivo: ${resultado.nomeArquivo}`,
                `Total de registros: ${resultado.total}`,
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
            { texto: 'Gerar backup', comando: 'backup' }
          ],
          ajuda: 'Logs de auditoria com todas as ações realizadas no sistema'
        })
      });
    } else {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Nenhum log de auditoria encontrado',
          emojiTitulo: '📄',
          dicas: [
            { texto: 'Ver status do sistema', comando: 'status' },
            { texto: 'Gerar backup', comando: 'backup' }
          ]
        })
      });
    }
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro ao gerar logs');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.ERRO_INTERNO('Gerar logs de auditoria', 'Tente novamente em alguns instantes')
    });
  }
}

export default logsCommand; 
import { logger } from '../infrastructure/logger';
