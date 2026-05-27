import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';
import * as driverService from '../services/driverService';
import { isPremium, MSG_UPGRADE } from '../services/planoService';

async function analisarCommand(sock, userId) {
  const premium = await isPremium(userId);
  if (!premium) {
    await sock.sendMessage(userId, { text: MSG_UPGRADE });
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
