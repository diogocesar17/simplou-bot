// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';

async function vencimentosCommand(sock, userId, texto) {
  const match = texto.toLowerCase().match(/^vencimentos\s*(\d+)?$/i);
  const dias = match && match[1] ? parseInt(match[1]) : 30;
  if (dias < 1 || dias > 365) {
    await sock.sendMessage(userId, { text: '❌ Período inválido. Use entre 1 e 365 dias.' });
    return;
  }
  const vencimentos = await lancamentosService.buscarProximosVencimentos(userId, dias);
  let msgVencimentos = `📅 *Próximos Vencimentos (${dias} dias):*\n\n`;
  let temVencimentos = false;
  // Cartões
  if (vencimentos.cartoes && vencimentos.cartoes.length > 0) {
    msgVencimentos += '💳 *Faturas de Cartão:*\n';
    vencimentos.cartoes.forEach((venc) => {
      const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
      msgVencimentos += `${emoji} ${venc.cartao_nome}: R$ ${formatarValor(venc.valor)} (${venc.dias_restantes} dias)\n`;
      msgVencimentos += `   📝 ${venc.descricao} | 📂 ${venc.categoria}\n\n`;
    });
    temVencimentos = true;
  }
  // Boletos
  if (vencimentos.boletos && vencimentos.boletos.length > 0) {
    msgVencimentos += '📄 *Boletos:*\n';
    vencimentos.boletos.forEach((venc) => {
      const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
      msgVencimentos += `${emoji} R$ ${formatarValor(venc.valor)} (${venc.dias_restantes} dias)\n`;
      msgVencimentos += `   📝 ${venc.descricao} | 📂 ${venc.categoria}\n\n`;
    });
    temVencimentos = true;
  }
  if (!temVencimentos) {
    msgVencimentos = `📅 Nenhum vencimento nos próximos ${dias} dias.`;
  }
  await sock.sendMessage(userId, { text: msgVencimentos });
}

export default vencimentosCommand; 