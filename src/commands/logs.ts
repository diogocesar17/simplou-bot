// @ts-nocheck
import * as sistemaService from '../services/sistemaService';

async function logsCommand(sock, userId) {
  try {
    // Gerar logs de auditoria em CSV
    const resultado = await sistemaService.gerarLogAuditoria(userId, 'recentes');
    
    if (resultado && resultado.sucesso) {
      let msg = '📄 *Logs de Auditoria gerados com sucesso!*\n\n';
      msg += `📁 Arquivo: ${resultado.nomeArquivo}\n`;
      msg += `📊 Total de registros: ${resultado.total}\n`;
      msg += `📏 Tamanho: ${resultado.tamanho} KB\n\n`;
      msg += '📥 *Arquivo salvo em:*\n';
      msg += `\`${resultado.caminhoArquivo}\`\n\n`;
      msg += '💡 *Conteúdo:*\n';
      msg += 'Logs de auditoria com todas as ações realizadas no sistema.';
      
      await sock.sendMessage(userId, { text: msg });
    } else {
      await sock.sendMessage(userId, { text: '📄 Nenhum log de auditoria encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao gerar logs:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro ao gerar logs de auditoria. Tente novamente.' 
    });
  }
}

export default logsCommand; 