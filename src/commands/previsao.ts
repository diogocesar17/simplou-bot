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
  await sock.sendMessage(userId, { text: previsao });
}

export default previsaoCommand; 