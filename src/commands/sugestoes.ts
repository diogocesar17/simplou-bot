import * as geminiService from '../services/geminiService';
import * as lancamentosService from '../services/lancamentosService';
import * as driverService from '../services/driverService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { isPremium, MSG_UPGRADE } from '../services/planoService';
import { verificarLimiteGeminiDia, incrementarGeminiDia } from '../services/rateLimitService';

const MSG_LIMITE_GEMINI = '⚠️ *Limite diário de IA atingido*\n\nVocê atingiu o limite de 30 análises por IA hoje. Tente novamente amanhã.';

async function sugestoesCommand(sock, userId) {
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
    lancamentosService.buscarDadosParaSugestoes(userId, 2),
    driverService.buildDriverContext(userId),
  ]);
  if (!dados || dados.length === 0) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Dados insuficientes',
        emojiTitulo: '❌',
        secoes: [{ titulo: 'Solução', itens: ['Registre alguns lançamentos primeiro'], emoji: '💡' }],
        dicas: gerarDicasContextuais('sugestoes'),
      }),
    });
    return;
  }
  await sock.sendMessage(userId, { text: '💡 Gerando sugestões para aumentar sua rentabilidade... Isso pode levar alguns segundos.' });

  incrementarGeminiDia(userId).catch(() => {});
  const sugestoes = await geminiService.gerarSugestoesEconomia(userId, dados, driverContext);
  if (!sugestoes) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'IA indisponível',
        emojiTitulo: '❌',
        secoes: [{ titulo: 'Solução', itens: ['Tente novamente em alguns instantes', 'Se estiver rodando localmente: verifique GEMINI_API_KEY no .env e reinicie o bot'], emoji: '💡' }],
        dicas: gerarDicasContextuais('sugestoes'),
      }),
    });
    return;
  }
  await sock.sendMessage(userId, { text: sugestoes });
}

export default sugestoesCommand;
