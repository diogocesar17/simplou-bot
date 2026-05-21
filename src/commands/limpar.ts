import * as sistemaService from '../services/sistemaService';
import * as usuariosService from '../services/usuariosService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function limparCommand(sock: any, userId: string) {
  const isAdmin = await usuariosService.verificarAdmin(userId);
  if (!isAdmin) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.SEM_PERMISSAO('Limpar dados', 'Apenas administradores podem executar este comando')
    });
    return;
  }

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
    if (resultado.lancamentosRemovidos === 0 && resultado.logsRemovidos === 0 && resultado.arquivosRemovidos === 0) {
      itens.push('Nenhum dado antigo foi encontrado para remoção');
    }
    
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Limpeza concluída',
        emojiTitulo: '🧹',
        secoes: [{
          titulo: 'Resultado da Limpeza',
          itens: itens,
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
}

export default limparCommand;