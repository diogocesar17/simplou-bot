import * as lancamentosService from '../services/lancamentosService';
import { obterEstado, limparEstado, definirEstado } from '../configs/stateManager';
import { formatarValor, formatarComMoeda } from '../utils/formatUtils';

async function desfazerCommand(sock, userId) {
  const estado = await obterEstado(userId);

  // Passo 1: mostrar o lançamento e pedir confirmação
  if (!estado || estado.etapa !== 'ultimo_lancamento') {
    await sock.sendMessage(userId, {
      text: 'Não há lançamento recente para desfazer. O desfazer funciona logo após registrar um gasto ou receita.'
    });
    return;
  }

  const dados = estado.dadosParciais as any;
  const TTL = 10 * 60 * 1000; // 10 minutos
  if (!dados?.lancamentoId || Date.now() - (dados.timestamp || 0) > TTL) {
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text: 'O lançamento expirou (disponível por 10 minutos após registrar). Use *historico* para excluir manualmente.'
    });
    return;
  }

  // Buscar o lançamento para mostrar detalhes
  const lancamento = await lancamentosService.buscarLancamentoPorId(userId, dados.lancamentoId);
  if (!lancamento) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: 'Lançamento não encontrado. Pode já ter sido excluído.' });
    return;
  }

  const emojiTipo = lancamento.tipo === 'receita' ? '💰' : '💸';
  await definirEstado(userId, 'confirmando_desfazer', { lancamentoId: dados.lancamentoId });
  await sock.sendMessage(userId, {
    text:
      `⚠️ *Desfazer lançamento?*\n\n` +
      `${emojiTipo} ${formatarComMoeda(lancamento.valor)} — ${lancamento.categoria}\n` +
      `💳 ${lancamento.pagamento} · 📅 ${new Date(lancamento.data).toLocaleDateString('pt-BR')}\n` +
      (lancamento.descricao ? `📝 ${lancamento.descricao}\n` : '') +
      `\nDigite *sim* para confirmar ou *não* para cancelar.`
  });
}

async function desfazerConfirmarCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);

  if (!estado || estado.etapa !== 'confirmando_desfazer') return;

  if (textoLower === 'sim') {
    const lancamentoId = (estado.dadosParciais as any)?.lancamentoId;
    await limparEstado(userId);
    if (lancamentoId) {
      await lancamentosService.excluirLancamento(userId, lancamentoId);
      await sock.sendMessage(userId, { text: '✅ Lançamento desfeito com sucesso.' });
    }
  } else {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: 'Cancelado. O lançamento foi mantido.' });
  }
}

export { desfazerConfirmarCommand };
export default desfazerCommand;
