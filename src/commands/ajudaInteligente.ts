// @ts-nocheck
// Importar o contexto global (aguardandoPerguntaInteligente)
// Nota: O contexto é gerenciado no src/index.js

async function ajudaInteligenteCommand(sock, userId) {
  // Ativar contexto para aguardar pergunta inteligente
  global.aguardandoPerguntaInteligente[userId] = true;
  
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