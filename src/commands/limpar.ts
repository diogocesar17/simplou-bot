import * as sistemaService from '../services/sistemaService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';

async function limparCommand(sock: any, userId: string) {
  // Limpar dados antigos reais
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