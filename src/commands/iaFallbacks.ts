import * as usuariosService from '../services/usuariosService';
import * as databaseService from '../infrastructure/databaseService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';
import { formatarValor, formatarComMoeda } from '../utils/formatUtils';

async function iaFallbacksCommand(sock, userId, texto: string) {
  const isAdmin = await usuariosService.verificarAdmin(userId);
  if (!isAdmin) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.SEM_PERMISSAO('Ver IA fallbacks', 'Apenas administradores podem executar este comando')
    });
    return;
  }

  const partes = texto.trim().split(/\s+/);
  const limite = parseInt(partes[2] || '20', 10) || 20;

  const rows = await databaseService.consultarIAFallbacks(limite);

  if (!rows || rows.length === 0) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'IA Fallback Log',
        emojiTitulo: '🤖',
        secoes: [{ titulo: 'Resultado', itens: ['Nenhum fallback registrado ainda.'], emoji: '✅' }]
      })
    });
    return;
  }

  const itens = rows.map((r, i) => {
    const frase = r.frase.length > 60 ? r.frase.slice(0, 57) + '...' : r.frase;
    const cat = r.categoria_ia || '?';
    const tipo = r.tipo_ia || '?';
    const valor = r.valor_ia ? `${formatarComMoeda(parseFloat(r.valor_ia))}` : '?';
    return `${i + 1}. [${r.total}x] "${frase}"\n   → ${tipo} | ${cat} | ${valor}`;
  });

  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: `Top ${rows.length} frases que foram para IA`,
      emojiTitulo: '🤖',
      secoes: [{
        titulo: 'Frases não cobertas pelo parser (candidatas a regra)',
        itens,
        emoji: '📋'
      }],
      ajuda: 'Cada linha: [vezes que ocorreu] frase → tipo | categoria | valor detectado pela IA'
    })
  });
}

export default iaFallbacksCommand;
