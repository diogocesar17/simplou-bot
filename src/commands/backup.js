const sistemaService = require('../services/sistemaService');

async function backupCommand(sock, userId) {
  try {
    const resultado = await sistemaService.gerarBackupCSV(userId);
    
    if (resultado.sucesso) {
      let msg = '💾 *Backup gerado com sucesso!*\n\n';
      msg += `📁 Arquivo: ${resultado.nomeArquivo}\n`;
      msg += `📊 Lançamentos: ${resultado.totalLancamentos}\n`;
      msg += `📅 Período: ${resultado.periodo}\n`;
      msg += `📏 Tamanho: ${resultado.tamanhoArquivo}\n\n`;
      msg += '📥 *Para baixar:*\n';
      msg += 'O arquivo foi salvo no servidor e pode ser acessado via API ou interface administrativa.';
      
      await sock.sendMessage(userId, { text: msg });
    } else {
      await sock.sendMessage(userId, { 
        text: '❌ Erro ao gerar backup. Tente novamente mais tarde.' 
      });
    }
  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    await sock.sendMessage(userId, { 
      text: '❌ Erro interno ao gerar backup. Tente novamente.' 
    });
  }
}

module.exports = backupCommand; 