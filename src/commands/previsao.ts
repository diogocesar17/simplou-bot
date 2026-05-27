import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';
import * as driverService from '../services/driverService';
import { isPremium, MSG_UPGRADE } from '../services/planoService';

async function previsaoCommand(sock, userId) {
  const premium = await isPremium(userId);
  if (!premium) {
    await sock.sendMessage(userId, { text: MSG_UPGRADE });
    return;
  }
  const [dados, driverContext] = await Promise.all([
    lancamentosService.buscarDadosParaPrevisao(userId, 6),
    driverService.buildDriverContext(userId),
  ]);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para fazer previsões. Registre lançamentos de pelo menos 3 meses primeiro.' });
    return;
  }
  await sock.sendMessage(userId, { text: '🔮 Analisando seus ganhos e custos dos últimos meses... Isso pode levar alguns segundos.' });

  const previsao = await geminiService.preverGastosFuturos(userId, dados, driverContext);
  if (!previsao) {
    await sock.sendMessage(userId, {
      text:
        '❌ IA indisponível no momento.\n\n' +
        'Se você estiver rodando localmente, verifique a variável GEMINI_API_KEY no .env e reinicie o bot.',
    });
    return;
  }
  await sock.sendMessage(userId, { text: previsao });
}

export default previsaoCommand;
