async function meuidCommand(sock, userId) {
  await sock.sendMessage(userId, { text: `🆔 *Seu ID do WhatsApp:*\n\n📱 ${userId}\n\n(TODO: personalizar mensagem se necessário)` });
}

module.exports = meuidCommand; 