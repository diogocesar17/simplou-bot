// @ts-nocheck
import * as lancamentosService from '../services/lancamentosService';
import { obterEstado, limparEstado } from '../configs/stateManager';

async function excluirLancamentoCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^excluir\s+(\d+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { text: '❌ Use: excluir [número]. Exemplo: excluir 3' });
    return;
  }
  
  // Verificar se há um histórico exibido no estado
  const estado = await obterEstado(userId);
  if (!estado || estado.etapa !== 'historico_exibido') {
    await sock.sendMessage(userId, { 
      text: '❌ Execute "histórico" primeiro para ver a lista de lançamentos disponíveis para exclusão.' 
    });
    return;
  }
  
  // Verificar se o estado não expirou (mais de 10 minutos)
  const agora = Date.now();
  const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
  if (agora - estado.dadosParciais.timestamp > tempoExpiracao) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { 
      text: '❌ A lista expirou. Execute "histórico" novamente para ver os lançamentos.' 
    });
    return;
  }
  
  const idx = parseInt(match[1], 10) - 1;
  const lista = estado.dadosParciais.lista;
  
  if (!lista || !lista[idx]) {
    await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
    return;
  }
  
  const lancamento = lista[idx];
  try {
    // Chamar serviço para excluir
    await lancamentosService.excluirLancamentoPorId(userId, lancamento.id);
    
    // Limpar estado após exclusão bem-sucedida
    await limparEstado(userId);
    
    await sock.sendMessage(userId, { 
      text: `✅ *Lançamento excluído com sucesso!*\n\n📝 Descrição: ${lancamento.descricao}\n💰 Valor: R$ ${lancamento.valor}\n📂 Categoria: ${lancamento.categoria}` 
    });
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    await sock.sendMessage(userId, { text: '❌ Erro ao excluir lançamento. Tente novamente.' });
  }
}

export default excluirLancamentoCommand; 