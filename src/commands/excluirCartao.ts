// @ts-nocheck
import * as cartoesService from '../services/cartoesService';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';


// Contexto simples em memória
const aguardandoExclusaoCartao = {};

async function excluirCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando escolha do cartão
  if (estado?.etapa === 'aguardando_escolha_exclusao_cartao') {
    const escolha = texto.trim();
    if (escolha.toLowerCase() === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Exclusão de cartão cancelada.' });
      return;
    }
    const idx = parseInt(escolha);
    const cartoes = estado.dadosParciais.cartoes;
    
    if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
      await sock.sendMessage(userId, { text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".` });
      return;
    }
    const cartaoEscolhido = cartoes[idx - 1];
    // Verificar lançamentos associados (mock: 0)
    const totalLancamentos = await cartoesService.contarLancamentosAssociadosCartao(userId, cartaoEscolhido.nome_cartao);
    let msgConfirmacao = `🗑️ *Confirmar exclusão do cartão*\n\n`;
    msgConfirmacao += `💳 Cartão: ${cartaoEscolhido.nome_cartao}\n`;
    msgConfirmacao += `📅 Vencimento: dia ${cartaoEscolhido.dia_vencimento}\n`;
    if (cartaoEscolhido.dia_fechamento) {
      msgConfirmacao += `📅 Fechamento: dia ${cartaoEscolhido.dia_fechamento}\n`;
    }
    msgConfirmacao += `📊 Lançamentos associados: ${totalLancamentos}\n\n`;
    if (totalLancamentos > 0) {
      msgConfirmacao += `⚠️ *ATENÇÃO:* Este cartão possui ${totalLancamentos} lançamento(s) associado(s).\n`;
      msgConfirmacao += `Os lançamentos continuarão existindo, mas ficarão sem referência ao cartão.\n\n`;
    }
    msgConfirmacao += `❓ Confirma a exclusão?\nDigite "sim" para confirmar ou "cancelar" para abortar.`;
    await definirEstado(userId, 'aguardando_confirmacao_exclusao_cartao', { cartaoEscolhido, totalLancamentos });
    await sock.sendMessage(userId, { text: msgConfirmacao });
    return;
  }
  // 2. Se está aguardando confirmação
  if (estado?.etapa === 'aguardando_confirmacao_exclusao_cartao') {
    const confirmacao = texto.trim().toLowerCase();
    if (confirmacao === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Exclusão de cartão cancelada.' });
      return;
    }
    if (confirmacao !== 'sim') {
      await sock.sendMessage(userId, { text: '❌ Confirmação inválida. Digite "sim" para confirmar ou "cancelar" para abortar.' });
      return;
    }
    const cartao = estado.dadosParciais.cartaoEscolhido;
    const totalLancamentos = estado.dadosParciais.totalLancamentos;
    await cartoesService.excluirCartaoConfigurado(userId, cartao.nome_cartao);
    let msgSucesso = `✅ Cartão excluído com sucesso!\n\n`;
    msgSucesso += `💳 Cartão: ${cartao.nome_cartao}\n`;
    msgSucesso += `📊 Lançamentos associados: ${totalLancamentos}\n\n`;
    if (totalLancamentos > 0) {
      msgSucesso += `ℹ️ Os ${totalLancamentos} lançamento(s) associado(s) continuam no sistema, mas sem referência ao cartão.\n`;
      msgSucesso += `Para limpar completamente, você pode editar os lançamentos individualmente.`;
    }
    await sock.sendMessage(userId, { text: msgSucesso });
    await limparEstado(userId);
    return;
  }
  // 3. Início do fluxo: listar cartões
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado para excluir.' });
    return;
  }
  let msgCartoes = 'Qual cartão deseja excluir?\n';
  cartoes.forEach((cartao, idx) => {
    msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
  });
  msgCartoes += '\nDigite o número do cartão ou "cancelar"';
  await definirEstado(userId, 'aguardando_escolha_exclusao_cartao', { cartoes });
  await sock.sendMessage(userId, { text: msgCartoes });
}

export default excluirCartaoCommand; 