// @ts-nocheck
// Comando para listar usuários (apenas para admins)
import * as usuariosService from '../services/usuariosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function listarUsuariosCommand(sock, userId, texto) {
  try {
    // Verificar se o usuário é admin
    const isAdmin = await usuariosService.verificarAdmin(userId);
    if (!isAdmin) {
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.SEM_PERMISSAO('Listar usuários', 'Apenas administradores podem executar este comando')
      });
      return;
    }

    // Processar comando de listagem
    const resultado = await usuariosService.processarComandoUsuarios();
    
    // Enviar resposta
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Lista de Usuários',
        emojiTitulo: '👥',
        secoes: [
          {
            titulo: 'Usuários',
            itens: [resultado.message],
            emoji: '📊'
          }
        ],
        dicas: [
          { texto: 'Ver status do sistema', comando: 'status' },
          { texto: 'Ver logs do sistema', comando: 'logs' }
        ]
      })
    });
    
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro no comando listarUsuarios');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.ERRO_INTERNO('Listar usuários', 'Tente novamente em alguns instantes')
    });
  }
}

export default listarUsuariosCommand; 
import { logger } from '../infrastructure/logger';
