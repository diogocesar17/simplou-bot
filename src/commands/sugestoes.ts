// @ts-nocheck
import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';

async function sugestoesCommand(sock, userId) {
  // Buscar dados dos últimos 2 meses (como no fluxo original)
  const dados = await lancamentosService.buscarDadosParaSugestoes(userId, 2);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para gerar sugestões. Registre alguns lançamentos primeiro.' });
    return;
  }
  // Gerar sugestões usando IA real
  const sugestoes = await geminiService.gerarSugestoesEconomia(userId, dados);
  await sock.sendMessage(userId, { text: sugestoes });
}

export default sugestoesCommand; 