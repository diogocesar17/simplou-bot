const sistemaService = require('../services/sistemaService');

async function limparCommand(sock, userId) {
  // Limpar dados antigos reais
  const resultado = await sistemaService.limparDadosAntigos();
  if (resultado.sucesso) {
    let msg = '🧹 *Limpeza de dados antigos concluída!*\n\n';
    if (resultado.lancamentosRemovidos > 0) {
      msg += `📋 Lançamentos removidos: ${resultado.lancamentosRemovidos}\n`;
    }
    if (resultado.logsRemovidos > 0) {
      msg += `📄 Logs removidos: ${resultado.logsRemovidos}\n`;
    }
    if (resultado.arquivosRemovidos > 0) {
      msg += `📁 Arquivos temporários removidos: ${resultado.arquivosRemovidos}\n`;
    }
    if (resultado.lancamentosRemovidos === 0 && resultado.logsRemovidos === 0 && resultado.arquivosRemovidos === 0) {
      msg += 'ℹ️ Nenhum dado antigo foi encontrado para remoção.';
    }
    await sock.sendMessage(userId, { text: msg });
  } else {
    await sock.sendMessage(userId, { text: '❌ Erro ao limpar dados antigos. Tente novamente.' });
  }
}

module.exports = limparCommand; 