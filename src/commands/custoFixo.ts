import { formatarValor } from '../utils/formatUtils';
import * as driverService from '../services/driverService';
import { logger } from '../infrastructure/logger';

function removerAcentos(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizar(t: string) {
  return removerAcentos(String(t || '').toLowerCase()).trim();
}

function extrairValor(norm: string): number | null {
  const match = norm.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const v = parseFloat(match[1].replace(',', '.'));
  return isNaN(v) || v <= 0 ? null : v;
}

function detectarCategoria(norm: string): string {
  if (/\bseguro\b/.test(norm)) return 'Seguro Auto';
  if (/\bfinanciamento\b/.test(norm)) return 'Financiamento';
  if (/\binternet\b|\bcelular\b|\bplano\b/.test(norm)) return 'Celular';
  if (/\bipva\b|\blicenciamento\b/.test(norm)) return 'IPVA';
  if (/\bcombustivel\b|\bgasolina\b/.test(norm)) return 'Combustível';
  return 'Outros';
}

function detectarDescricao(texto: string, norm: string): string {
  // Tenta extrair o que está descrevendo (ex: "meu seguro custa 250" → "Seguro")
  const match = norm.match(/\b(?:meu|minha|o|a)\s+([a-z\s]{3,30})\s+(?:custa|e|eh|vale)\b/);
  if (match) return match[1].trim();
  const matchPago = norm.match(/\bpago\s+[\d.,]+.*?\bde\s+([a-z\s]{3,30})\b/);
  if (matchPago) return matchPago[1].trim();
  return detectarCategoria(norm);
}

async function listarCustosFixos(sock: any, userId: string): Promise<void> {
  const custos = await driverService.getFixedCosts(userId);
  if (custos.length === 0) {
    await sock.sendMessage(userId, {
      text:
        '📋 *Custos fixos mensais*\n\n' +
        'Você ainda não tem custos fixos cadastrados.\n\n' +
        'Para cadastrar:\n' +
        '• "meu seguro custa 250 por mês"\n' +
        '• "pago 1200 de financiamento"\n' +
        '• "internet do celular 60 por mês"',
    });
    return;
  }

  const totalMensal = custos
    .filter(c => c.recurrence === 'MONTHLY')
    .reduce((s, c) => s + c.amount, 0);

  const totalAnual = custos
    .filter(c => c.recurrence === 'YEARLY')
    .reduce((s, c) => s + c.amount, 0);

  let msg = '📋 *Seus custos fixos*\n\n';
  for (const c of custos) {
    const freq = c.recurrence === 'MONTHLY' ? '/mês' : '/ano';
    msg += `• ${c.description} (${c.category}): R$ ${formatarValor(c.amount)}${freq}\n`;
  }
  if (totalMensal > 0) {
    msg += `\n💸 Total mensal: R$ ${formatarValor(totalMensal)}`;
  }
  if (totalAnual > 0) {
    const mensalizado = totalAnual / 12;
    msg += `\n📅 Anuais (R$ ${formatarValor(totalAnual)}) = R$ ${formatarValor(mensalizado)}/mês`;
  }
  msg += '\n\nPara remover: "remover custo fixo [nome]"';
  await sock.sendMessage(userId, { text: msg });
}

export async function custoFixoCommand(sock: any, userId: string, texto: string): Promise<void> {
  const norm = normalizar(texto);

  try {
    // Listar
    if (
      ['custos fixos', 'custo fixo', 'ver custos fixos', 'meus custos fixos'].includes(norm)
    ) {
      return await listarCustosFixos(sock, userId);
    }

    // Remover
    if (/\bremover\s+custo\s+fixo\b/.test(norm)) {
      await sock.sendMessage(userId, {
        text: '⚠️ Para remover, acesse "custos fixos" para ver a lista e me diga qual deseja remover.',
      });
      return;
    }

    // Cadastrar — detecta "X custa Y por mês", "pago Y de X", "X 60 por mês"
    const valor = extrairValor(norm);
    if (!valor) {
      return await listarCustosFixos(sock, userId);
    }

    const recurrence: 'MONTHLY' | 'YEARLY' = /\bpor\s+ano\b|\banual\b/.test(norm) ? 'YEARLY' : 'MONTHLY';
    const categoria = detectarCategoria(norm);
    const descricao = detectarDescricao(texto, norm);
    const freqLabel = recurrence === 'MONTHLY' ? '/mês' : '/ano';

    await driverService.addFixedCost(userId, descricao, categoria, valor, recurrence);

    await sock.sendMessage(userId, {
      text:
        `✅ Custo fixo cadastrado:\n` +
        `📝 ${descricao} (${categoria})\n` +
        `💸 R$ ${formatarValor(valor)}${freqLabel}\n\n` +
        `Esses valores serão considerados no seu resumo mensal.\n` +
        `Para ver todos: "custos fixos"`,
    });
  } catch (err) {
    logger.error({ err }, '[CUSTO_FIXO] Erro');
    await sock.sendMessage(userId, { text: '❌ Erro ao processar. Tente novamente.' });
  }
}
