// @ts-nocheck
import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';

async function sugestoesCommand(sock, userId) {
  // Buscar dados dos últimos 2 meses (como no fluxo original)
  const dados = await lancamentosService.buscarDadosParaSugestoes(userId, 2);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Dados insuficientes',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Registre alguns lançamentos primeiro'],
          emoji: '💡'
        }],
        dicas: gerarDicasContextuais('sugestoes')
      })
    });
    return;
  }
  // Gerar sugestões usando IA real
  const sugestoes = await geminiService.gerarSugestoesEconomia(userId, dados);
  if (!sugestoes) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'IA indisponível',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: [
            'Tente novamente em alguns instantes',
            'Se estiver rodando localmente: verifique GEMINI_API_KEY no .env e reinicie o bot'
          ],
          emoji: '💡'
        }],
        dicas: gerarDicasContextuais('sugestoes')
      })
    });
    return;
  }
  await sock.sendMessage(userId, { text: sugestoes });
}

export default sugestoesCommand; 
