// @ts-nocheck
import * as sistemaService from '../services/sistemaService';

async function backupCommand(sock, userId) {
  try {
    const resultado = await sistemaService.gerarBackupCSV(userId);
    
    if (resultado && resultado.sucesso) {
      let msg = '💾 *Backup gerado com sucesso!*\n\n';
      msg += `📁 Arquivo: ${resultado.nomeArquivo}\n`;
      msg += `📊 Lançamentos: ${resultado.totalLancamentos}\n`;
      msg += `📅 Período: ${resultado.periodo}\n`;
      msg += `📏 Tamanho: ${resultado.tamanho} KB\n\n`;
      msg += '📥 *Arquivo salvo em:*\n';
      msg += `\`${resultado.caminhoArquivo}\`\n\n`;
      msg += '💡 *Para baixar:*\n';
      msg += 'O arquivo foi salvo no servidor. Você pode acessá-lo via FTP ou solicitar ao administrador.';
      
      await sock.sendMessage(userId, { text: msg });
    } else {
      const erroMsg = resultado?.erro || 'Erro desconhecido';
      await sock.sendMessage(userId, { 
        text: `❌ Erro ao gerar backup: ${erroMsg}\n\nTente novamente mais tarde.` 
      });
    }
  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao gerar backup. Tente novamente.' 
    });
  }
}

export default backupCommand; 