const { definirEstado, obterEstado, limparEstado } = require('./../configs/stateManager');
const cartoesService = require('../services/cartoesService');

async function configurarCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando nome do cartão
  if (estado?.etapa === 'aguardando_nome_cartao') {
    if (textoLimpo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
      return;
    }

    if (texto.length < 2 || texto.length > 20) {
      await sock.sendMessage(userId, { text: '❌ Nome do cartão inválido. Digite um nome entre 2 e 20 caracteres ou "cancelar".' });
      return;
    }

    const dados = { nomeCartao: texto.trim() };
    await definirEstado(userId, 'aguardando_vencimento_cartao', dados);
    await sock.sendMessage(userId, { text: `💳 Qual dia vence a fatura do ${dados.nomeCartao}? (1-31)\nExemplo: 15` });
    return;
  }

  // 2. Se está aguardando o vencimento
  if (estado?.etapa === 'aguardando_vencimento_cartao') {
    if (textoLimpo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
      return;
    }

    const dia = parseInt(texto.trim());
    if (isNaN(dia) || dia < 1 || dia > 31) {
      await sock.sendMessage(userId, { text: '❌ Dia inválido. Digite um número entre 1 e 31 ou "cancelar".' });
      return;
    }

    const dados = {
      ...estado.dadosParciais,
      diaVencimento: dia
    };
    await definirEstado(userId, 'aguardando_fechamento_cartao', dados);
    await sock.sendMessage(userId, {
      text: `📅 Qual dia de fechamento da fatura do ${dados.nomeCartao}? (1-31)\nExemplo: 7\nOu digite "padrão" para usar 7 dias antes do vencimento.`
    });
    return;
  }

  // 3. Se está aguardando o fechamento
  if (estado?.etapa === 'aguardando_fechamento_cartao') {
    if (textoLimpo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
      return;
    }

    let diaFechamento;
    if (['padrao', 'padrão'].includes(textoLimpo)) {
      diaFechamento = estado.dadosParciais.diaVencimento - 7;
      if (diaFechamento < 1) diaFechamento = 1;
    } else {
      diaFechamento = parseInt(texto);
      if (isNaN(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) {
        await sock.sendMessage(userId, {
          text: '❌ Dia de fechamento inválido. Digite um número entre 1 e 31, ou "padrão".'
        });
        return;
      }
    }

    const { nomeCartao, diaVencimento } = estado.dadosParciais;
    await cartoesService.salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento);
    await limparEstado(userId);

    await sock.sendMessage(userId, {
      text: `✅ Cartão ${nomeCartao} configurado com sucesso!\n\n💳 Vencimento: dia ${diaVencimento}\n📅 Fechamento: dia ${diaFechamento}`
    });
    return;
  }

  // 4. Início do fluxo
  await definirEstado(userId, 'aguardando_nome_cartao');
  await sock.sendMessage(userId, {
    text: '💳 Qual o nome do cartão? (Exemplo: Nubank, Itaú, Inter)\n\nDigite "cancelar" para abortar.'
  });
}

module.exports = configurarCartaoCommand;
