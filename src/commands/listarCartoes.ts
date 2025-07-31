// @ts-nocheck
import * as cartoesService from '../services/cartoesService';

async function listarCartoesCommand(sock, userId) {
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado.\n\nUse "configurar cartao" para cadastrar seu primeiro cartão.' });
    return;
  }
  let msgCartoes = '💳 *Cartões configurados:*\n\n';
  cartoes.forEach((cartao, idx) => {
    msgCartoes += `${idx + 1}. *${cartao.nome_cartao}*\n`;
    msgCartoes += `   📅 Vencimento: dia ${cartao.dia_vencimento}\n`;
    msgCartoes += `   📋 Fechamento: dia ${cartao.dia_fechamento || 'NÃO INFORMADO'}\n\n`;
  });
  msgCartoes += '💡 Use "editar cartao" para modificar vencimento ou fechamento.';
  await sock.sendMessage(userId, { text: msgCartoes });
}

export default listarCartoesCommand; 