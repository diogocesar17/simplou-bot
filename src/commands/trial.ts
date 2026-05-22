import { ativarTrialPremium } from '../services/usuariosService';

async function trialCommand(sock: any, userId: string) {
  const resultado = await ativarTrialPremium(userId);

  if (resultado.motivo === 'já_premium') {
    await sock.sendMessage(userId, { text: '⭐ Você já tem o Simplou Premium ativo!' });
    return;
  }
  if (resultado.motivo === 'já_usado') {
    await sock.sendMessage(userId, {
      text: '⚠️ Você já utilizou o período de trial anteriormente.\n\nPara continuar com o Premium, digite *assinar*.'
    });
    return;
  }
  if (!resultado.sucesso) {
    await sock.sendMessage(userId, { text: 'Não foi possível ativar o trial. Tente novamente.' });
    return;
  }

  const expiracao = new Date();
  expiracao.setDate(expiracao.getDate() + 7);
  await sock.sendMessage(userId, {
    text:
      '⭐ *Trial Premium ativado!*\n\n' +
      'Você tem *7 dias* de acesso completo ao Simplou Premium.\n\n' +
      `📅 Válido até: ${expiracao.toLocaleDateString('pt-BR')}\n\n` +
      '✨ *Desbloqueado agora:*\n' +
      '• analisar — análise de padrões com IA\n' +
      '• sugestoes — dicas de economia\n' +
      '• previsao — previsão de gastos\n' +
      '• ajuda inteligente — assistente financeiro\n\n' +
      'Após o trial, use *assinar* para continuar com o Premium.'
  });
}

export default trialCommand;
