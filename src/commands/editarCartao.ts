// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import * as cartoesService from '../services/cartoesService';

async function editarCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando escolha do cartão
  if (estado?.etapa === 'aguardando_escolha_edicao_cartao') {
    if (textoLimpo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
      return;
    }

    const idx = parseInt(texto);
    const cartoes = estado.dadosParciais.cartoes;

    if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
      await sock.sendMessage(userId, {
        text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".`
      });
      return;
    }

    const cartaoEscolhido = cartoes[idx - 1];
    await definirEstado(userId, 'aguardando_campo_edicao_cartao', { cartaoEscolhido });
    await sock.sendMessage(userId, {
      text: 'Qual campo deseja editar?\n1. vencimento\n2. fechamento\n3. cancelar'
    });
    return;
  }

  // 2. Se está aguardando escolha do campo
  if (estado?.etapa === 'aguardando_campo_edicao_cartao') {
    let campo = textoLimpo;
    if (["1", "vencimento"].includes(campo)) campo = 'vencimento';
    else if (["2", "fechamento"].includes(campo)) campo = 'fechamento';
    else if (["3", "cancelar"].includes(campo)) campo = 'cancelar';

    if (campo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
      return;
    }

    if (!['vencimento', 'fechamento'].includes(campo)) {
      await sock.sendMessage(userId, {
        text: '❌ Campo inválido. Digite: 1, 2, 3 ou o nome do campo.'
      });
      return;
    }

    const dados = {
      ...estado.dadosParciais,
      campoEscolhido: campo
    };

    await definirEstado(userId, 'aguardando_novo_valor_edicao_cartao', dados);
    await sock.sendMessage(userId, {
      text: `Digite o novo dia de ${campo} (1-31):`
    });
    return;
  }

  // 3. Se está aguardando o novo valor
  if (estado?.etapa === 'aguardando_novo_valor_edicao_cartao') {
    const campo = estado.dadosParciais.campoEscolhido;
    const cartao = estado.dadosParciais.cartaoEscolhido;

    const dia = parseInt(texto);
    if (isNaN(dia) || dia < 1 || dia > 31) {
      await sock.sendMessage(userId, {
        text: `❌ Dia de ${campo} inválido. Digite um número entre 1 e 31.`
      });
      return;
    }

    // Atualizar campo
    let novoVencimento = cartao.dia_vencimento;
    let novoFechamento = cartao.dia_fechamento;
    if (campo === 'vencimento') novoVencimento = dia;
    if (campo === 'fechamento') novoFechamento = dia;

    await cartoesService.atualizarCartaoConfigurado(userId, cartao.nome_cartao, novoVencimento, novoFechamento);

    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text: `✅ Cartão ${cartao.nome_cartao} atualizado!\n💳 Vencimento: dia ${novoVencimento}\n📅 Fechamento: dia ${novoFechamento}`
    });
    return;
  }

  // 4. Início do fluxo: listar cartões
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado para editar.' });
    return;
  }

  let msgCartoes = 'Qual cartão deseja editar?\n';
  cartoes.forEach((cartao, idx) => {
    msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
  });
  msgCartoes += '\nDigite o número do cartão ou "cancelar"';

  await definirEstado(userId, 'aguardando_escolha_edicao_cartao', { cartoes });
  await sock.sendMessage(userId, { text: msgCartoes });
}

export default editarCartaoCommand;
