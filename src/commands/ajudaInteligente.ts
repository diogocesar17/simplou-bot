import { definirEstado } from '../configs/stateManager';
import { isPremium, MSG_UPGRADE } from '../services/planoService';

async function ajudaInteligenteCommand(sock, userId) {
  const premium = await isPremium(userId);
  if (!premium) {
    await sock.sendMessage(userId, { text: MSG_UPGRADE });
    return;
  }
  // Definir etapa no Redis para aguardar pergunta inteligente (TTL padrão 10min)
  await definirEstado(userId, 'pergunta_inteligente', {});
  
  const msg = '🤖 *Assistente Inteligente Ativado*\n\n' +
    'Agora você pode fazer perguntas sobre suas finanças!\n\n' +
    '💡 *Exemplos de perguntas:*\n' +
    '• "Como posso economizar mais?"\n' +
    '• "Qual foi meu maior gasto este mês?"\n' +
    '• "Estou gastando muito com delivery?"\n' +
    '• "Como está minha saúde financeira?"\n' +
    '• "Quais são minhas despesas recorrentes?"\n\n' +
    '📝 *Digite sua pergunta agora:*';
  
  await sock.sendMessage(userId, { text: msg });
}

export default ajudaInteligenteCommand; 
