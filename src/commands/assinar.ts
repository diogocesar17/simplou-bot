async function assinarCommand(sock: any, userId: string) {
  const linkPagamento = process.env.LINK_PAGAMENTO_PREMIUM || 'https://wa.me/SEU_NUMERO';

  const msg =
    '⭐ *Simplou Premium*\n\n' +
    '📋 *O que você ganha:*\n' +
    '• Análises inteligentes de gastos com IA\n' +
    '• Registro por áudio e comprovante (foto/PDF)\n' +
    '• Lembretes ilimitados\n' +
    '• Previsão de gastos futuros\n' +
    '• Sugestões personalizadas de economia\n\n' +
    '💰 *Investimento:* Consulte os planos disponíveis\n\n' +
    `🔗 *Para assinar:* ${linkPagamento}\n\n` +
    '• Ou experimente *7 dias grátis* digitando *trial*\n\n' +
    '_Após o pagamento, seu acesso é ativado em até 24h._';

  await sock.sendMessage(userId, { text: msg });
}

export default assinarCommand;
