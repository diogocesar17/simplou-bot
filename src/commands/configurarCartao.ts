import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import * as cartoesService from '../services/cartoesService';
import { formatarCancelamento } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function configurarCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando nome do cartão
  if (estado?.etapa === 'aguardando_nome_cartao') {
    if (textoLimpo === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Configuração de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    if (texto.length < 2 || texto.length > 20) {
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.VALOR_INVALIDO('Nome do cartão', 'Entre 2 e 20 caracteres\nExemplo: Nubank, Itaú, Inter') });
      return;
    }

    const dados = { nomeCartao: texto.trim() };
    await definirEstado(userId, 'aguardando_vencimento_cartao', dados);
    await sock.sendMessage(userId, { 
      text: `💳 Qual dia vence a fatura do ${dados.nomeCartao}? (1-31)\nExemplo: 15\n\n💡 Digite \`0\` ou \`cancelar\` para cancelar` 
    });
    return;
  }

  // 2. Se está aguardando o vencimento
  if (estado?.etapa === 'aguardando_vencimento_cartao') {
    if (textoLimpo === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Configuração de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const dia = parseInt(texto.trim());
    if (isNaN(dia) || dia < 1 || dia > 31) {
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.VALOR_INVALIDO('Dia de vencimento', 'Número entre 1 e 31\nExemplo: 15') });
      return;
    }

    const { nomeCartao } = estado.dadosParciais as any;
    await cartoesService.salvarConfiguracaoCartao(userId, nomeCartao, dia, null);
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text: `✅ *Cartão ${nomeCartao} configurado!*\n\n📅 Vencimento: dia ${dia}\n\n💡 Agora você pode usar "${nomeCartao}" nos seus lançamentos.`
    });
    return;
  }

  // 4. Início do fluxo
  await definirEstado(userId, 'aguardando_nome_cartao');
  await sock.sendMessage(userId, {
    text: '💳 *Configurar Novo Cartão*\n\n📝 Qual o nome do cartão?\nExemplo: Nubank, Itaú, Inter\n\n🛑 *Cancelar:* Digite \`0\` ou \`cancelar\`'
  });
}

export default configurarCartaoCommand;
