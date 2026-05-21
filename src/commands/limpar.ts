import * as sistemaService from '../services/sistemaService';
import * as usuariosService from '../services/usuariosService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';

async function limparCommand(sock: any, userId: string, texto?: string) {
  const isAdmin = await usuariosService.verificarAdmin(userId);
  if (!isAdmin) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.SEM_PERMISSAO('Limpar dados', 'Apenas administradores podem executar este comando')
    });
    return;
  }

  const estado = await obterEstado(userId);

  // Segundo passo: usuário respondeu à confirmação
  if (estado?.etapa === 'aguardando_confirmacao_limpar') {
    await limparEstado(userId);

    if (texto?.trim() === 'CONFIRMAR') {
      const resultado = await sistemaService.limparDadosAntigos();
      if (resultado.sucesso) {
        const itens: string[] = [];
        if (resultado.lancamentosRemovidos > 0) {
          itens.push(`Lançamentos removidos: ${resultado.lancamentosRemovidos}`);
        }
        if (resultado.logsRemovidos > 0) {
          itens.push(`Logs removidos: ${resultado.logsRemovidos}`);
        }
        if (resultado.arquivosRemovidos > 0) {
          itens.push(`Arquivos temporários removidos: ${resultado.arquivosRemovidos}`);
        }
        if (itens.length === 0) {
          itens.push('Nenhum dado antigo foi encontrado para remoção');
        }

        await sock.sendMessage(userId, {
          text: formatarMensagem({
            titulo: 'Limpeza concluída',
            emojiTitulo: '🧹',
            secoes: [{
              titulo: 'Resultado da Limpeza',
              itens,
              emoji: '📋'
            }],
            dicas: gerarDicasContextuais('limpar')
          })
        });
      } else {
        await sock.sendMessage(userId, {
          text: formatarMensagem({
            titulo: 'Erro na limpeza',
            emojiTitulo: '❌',
            secoes: [{
              titulo: 'Solução',
              itens: ['Tente novamente em alguns instantes'],
              emoji: '💡'
            }],
            dicas: gerarDicasContextuais('limpar')
          })
        });
      }
    } else {
      await sock.sendMessage(userId, {
        text: '❌ *Operação cancelada.* Nenhum dado foi apagado.'
      });
    }
    return;
  }

  // Primeiro passo: exibir aviso e pedir confirmação
  await definirEstado(userId, 'aguardando_confirmacao_limpar');
  await sock.sendMessage(userId, {
    text:
      '⚠️ *ATENÇÃO — Ação irreversível!*\n\n' +
      'Esta operação irá apagar permanentemente:\n' +
      '• Todos os lançamentos financeiros\n' +
      '• Todos os lembretes\n' +
      '• Todas as configurações de cartão\n\n' +
      'Para confirmar, responda exatamente:\n' +
      '*CONFIRMAR*\n\n' +
      'Qualquer outra resposta cancelará a operação.'
  });
}

export default limparCommand;
