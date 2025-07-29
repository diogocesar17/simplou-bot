const sistemaService = require('../services/sistemaService');

async function logsCommand(sock, userId) {
  // Gerar logs de auditoria reais
  const logs = await sistemaService.gerarLogsAuditoria();
  if (!logs || logs.length === 0) {
    await sock.sendMessage(userId, { text: '📄 Nenhum log de auditoria encontrado.' });
    return;
  }
  let msgLogs = '📄 *Logs de Auditoria:*\n\n';
  logs.forEach((log, idx) => {
    const data = new Date(log.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    msgLogs += `${idx + 1}. ${data} | ${log.user_id} | ${log.acao} | ${log.detalhes}\n`;
  });
  msgLogs += `\n📊 Total: ${logs.length} registros`;
  await sock.sendMessage(userId, { text: msgLogs });
}

module.exports = logsCommand; 