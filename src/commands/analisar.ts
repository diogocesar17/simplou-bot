import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';
import * as driverService from '../services/driverService';
import { isPremium, MSG_UPGRADE } from '../services/planoService';
import { verificarLimiteGeminiDia, incrementarGeminiDia } from '../services/rateLimitService';

const MSG_LIMITE_GEMINI = '⚠️ *Limite diário de IA atingido*\n\nVocê atingiu o limite de 30 análises por IA hoje. Tente novamente amanhã.';

async function analisarCommand(sock, userId) {
  const premium = await isPremium(userId);
  if (!premium) {
    await sock.sendMessage(userId, { text: MSG_UPGRADE });
    return;
  }
  if (!(await verificarLimiteGeminiDia(userId))) {
    await sock.sendMessage(userId, { text: MSG_LIMITE_GEMINI });
    return;
  }
  const [dados, driverContext] = await Promise.all([
    lancamentosService.buscarDadosParaAnalise(userId, 3),
    driverService.buildDriverContext(userId),
  ]);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para análise. Registre lançamentos de pelo menos 2 meses primeiro.' });
    return;
  }
  await sock.sendMessage(userId, { text: '🔍 Analisando seus padrões de ganhos e custos... Isso pode levar alguns segundos.' });

  incrementarGeminiDia(userId).catch(() => {});
  const analise = await geminiService.analisarPadroesGastos(userId, dados, driverContext);
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
