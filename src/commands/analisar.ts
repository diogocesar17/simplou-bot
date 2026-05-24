import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';
import { isPremium, MSG_UPGRADE } from '../services/planoService';

async function analisarCommand(sock, userId) {
  const premium = await isPremium(userId);
  if (!premium) {
    await sock.sendMessage(userId, { text: MSG_UPGRADE });
    return;
  }
  // Buscar dados dos últimos 3 meses (como no fluxo original)
  const dados = await lancamentosService.buscarDadosParaAnalise(userId, 3);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para análise. Registre lançamentos de pelo menos 2 meses primeiro.' });
    return;
  }
  await sock.sendMessage(userId, { text: '🔍 Analisando seus padrões de gastos... Isso pode levar alguns segundos.' });

  // Gerar análise usando IA real
  const analise = await geminiService.analisarPadroesGastos(userId, dados);
  if (!analise) {
    await sock.sendMessage(userId, {
      text:
        '❌ IA indisponível no momento.\n\n' +
        'Se você estiver rodando localmente, verifique a variável GEMINI_API_KEY no .env e reinicie o bot.',
    });
    return;
  }
  await sock.sendMessage(userId, { text: analise });
}

export default analisarCommand; 
