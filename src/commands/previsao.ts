// @ts-nocheck
import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';

async function previsaoCommand(sock, userId) {
  // Buscar dados dos últimos 6 meses (como no fluxo original)
  const dados = await lancamentosService.buscarDadosParaPrevisao(userId, 6);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para fazer previsões. Registre lançamentos de pelo menos 3 meses primeiro.' });
    return;
  }
  // Gerar previsão usando IA real
  const previsao = await geminiService.preverGastosFuturos(userId, dados);
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
