// @ts-nocheck
import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';

async function analisarCommand(sock, userId) {
  // Buscar dados dos últimos 3 meses (como no fluxo original)
  const dados = await lancamentosService.buscarDadosParaAnalise(userId, 3);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para análise. Registre lançamentos de pelo menos 2 meses primeiro.' });
    return;
  }
  // Gerar análise usando IA real
  const analise = await geminiService.analisarPadroesGastos(userId, dados);
  await sock.sendMessage(userId, { text: analise });
}

export default analisarCommand; 