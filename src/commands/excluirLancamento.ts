// @ts-nocheck
import * as lancamentosService from '../services/lancamentosService';

async function excluirLancamentoCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^excluir\s+(\d+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { text: '❌ Use: excluir [número]. Exemplo: excluir 3' });
    return;
  }
  const idx = parseInt(match[1], 10) - 1;
  // Buscar lista de lançamentos do usuário (mock: buscar últimos 10)
  const lista = await lancamentosService.listarLancamentos(userId, 10);
  if (!lista || !lista[idx]) {
    await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
    return;
  }
  const lancamento = lista[idx];
  // Chamar serviço para excluir
  const ok = await lancamentosService.excluirLancamentoPorId(userId, lancamento.id);
  if (ok) {
    await sock.sendMessage(userId, { text: '✅ Lançamento excluído com sucesso!' });
  } else {
    await sock.sendMessage(userId, { text: '❌ Erro ao excluir lançamento.' });
  }
}

export default excluirLancamentoCommand; 