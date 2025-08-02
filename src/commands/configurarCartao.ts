// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import * as cartoesService from '../services/cartoesService';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/errorMessages';

async function configurarCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando nome do cartão
  if (estado?.etapa === 'aguardando_nome_cartao') {
    if (textoLimpo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.OPERACAO_CANCELADA('Configuração de cartão') });
      return;
    }

    if (texto.length < 2 || texto.length > 20) {
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.VALOR_INVALIDO('Nome do cartão', 'Entre 2 e 20 caracteres\nExemplo: Nubank, Itaú, Inter') });
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
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.OPERACAO_CANCELADA('Configuração de cartão') });
      return;
    }

    const dia = parseInt(texto.trim());
    if (isNaN(dia) || dia < 1 || dia > 31) {
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.VALOR_INVALIDO('Dia de vencimento', 'Número entre 1 e 31\nExemplo: 15') });
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
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.OPERACAO_CANCELADA('Configuração de cartão') });
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
          text: ERROR_MESSAGES.VALOR_INVALIDO('Dia de fechamento', 'Número entre 1 e 31\nOu digite "padrão" para usar 7 dias antes do vencimento')
        });
        return;
      }
    }

    const { nomeCartao, diaVencimento } = estado.dadosParciais;
    await cartoesService.salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento);
    await limparEstado(userId);

    await sock.sendMessage(userId, {
      text: SUCCESS_MESSAGES.CARTAO_CONFIGURADO(nomeCartao, diaVencimento, diaFechamento)
    });
    return;
  }

  // 4. Início do fluxo
  await definirEstado(userId, 'aguardando_nome_cartao');
  await sock.sendMessage(userId, {
    text: '💳 Qual o nome do cartão? (Exemplo: Nubank, Itaú, Inter)\n\nDigite "cancelar" para abortar.'
  });
}

export default configurarCartaoCommand;
