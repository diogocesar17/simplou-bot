import type { ParsedIntent } from './intentTypes';
import { parseIntentLocal, normalizarMensagem } from './intentParser';
import { classifyIntentWithGemini } from './geminiIntentClassifier';
import { logger } from '../infrastructure/logger';
import * as cartoesService from '../services/cartoesService';
import * as lancamentosService from '../services/lancamentosService';
import { formatarValor } from '../utils/formatUtils';
import { getNomeMes } from '../utils/dataUtils';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatarDiaMes(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

function formatarDiaMesAno(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function obterNomeMes(mes: number): string {
  return getNomeMes(mes - 1);
}

function calcularReferenciaFatura(cartao: any, status: 'OPEN' | 'CLOSED', now: Date): { mes: number; ano: number } | null {
  const diaHoje = now.getDate();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const diaFechamento = cartao?.dia_fechamento ?? null;
  const diaVencimento = cartao?.dia_vencimento ?? null;

  if (!diaVencimento) return null;

  if (diaFechamento !== null && diaFechamento !== undefined) {
    if (status === 'OPEN') {
      if (diaHoje < diaFechamento) return { mes: mesAtual, ano: anoAtual };
      if (mesAtual === 12) return { mes: 1, ano: anoAtual + 1 };
      return { mes: mesAtual + 1, ano: anoAtual };
    }

    if (diaHoje > diaFechamento) return { mes: mesAtual, ano: anoAtual };
    if (mesAtual === 1) return { mes: 12, ano: anoAtual - 1 };
    return { mes: mesAtual - 1, ano: anoAtual };
  }

  if (status === 'OPEN') {
    if (diaHoje <= diaVencimento) return { mes: mesAtual, ano: anoAtual };
    if (mesAtual === 12) return { mes: 1, ano: anoAtual + 1 };
    return { mes: mesAtual + 1, ano: anoAtual };
  }

  return null;
}

function calcularDatasFatura(cartao: any, mes: number, ano: number): { fechamento: Date | null; vencimento: Date } {
  const diaFechamento = cartao?.dia_fechamento ?? null;
  const diaVencimento = cartao?.dia_vencimento;
  const vencimento = new Date(ano, mes - 1, diaVencimento);
  const fechamento = (diaFechamento !== null && diaFechamento !== undefined)
    ? new Date(ano, mes - 1, diaFechamento)
    : null;
  return { fechamento, vencimento };
}

function removerAcentos(texto: string): string {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarTexto(texto: string): string {
  return removerAcentos(String(texto || '')).toLowerCase().trim();
}

function selecionarCartao(cartoes: any[], cardName?: string): { ok: true; cartao?: any; cartoes?: any[] } | { ok: false; mensagem: string } {
  if (!cardName) return { ok: true, cartoes };
  const alvo = normalizarTexto(cardName);

  const candidatos = cartoes
    .map(c => {
      const n = normalizarTexto(c.nome_cartao);
      let score = 0;
      if (n === alvo) score = 3;
      else if (n.includes(alvo) || alvo.includes(n)) score = 2;
      else {
        const palavras = alvo.split(/\s+/).filter(Boolean);
        if (palavras.length && palavras.every(p => n.includes(p))) score = 1;
      }
      return { cartao: c, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.cartao.nome_cartao).localeCompare(String(b.cartao.nome_cartao)));

  if (candidatos.length === 0) {
    return { ok: false, mensagem: `❌ Não encontrei o cartão "${cardName}". Use "cartoes" para ver os cadastrados.` };
  }

  const topScore = candidatos[0].score;
  const tops = candidatos.filter(c => c.score === topScore);
  if (tops.length > 1) {
    return { ok: false, mensagem: `⚠️ Encontrei mais de um cartão parecido: ${tops.map(t => t.cartao.nome_cartao).join(', ')}. Qual deles?` };
  }

  return { ok: true, cartao: tops[0].cartao };
}

export async function handleInvoiceSummary(userId: string, parsedIntent: ParsedIntent): Promise<string> {
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    return '❌ Você ainda não tem cartões cadastrados. Digite "configurar cartao" para cadastrar.';
  }

  const selecao = selecionarCartao(cartoes, parsedIntent.cardName);
  if (!selecao.ok) return selecao.mensagem;

  const now = new Date();
  const status = parsedIntent.status || 'OPEN';
  const month = parsedIntent.month;
  const year = parsedIntent.year || (month ? now.getFullYear() : undefined);
  const hasMesAno = !!(month && year);

  const alvoCartoes = selecao.cartao ? [selecao.cartao] : (selecao.cartoes || cartoes);

  if (!hasMesAno && selecao.cartao) {
    const ref = calcularReferenciaFatura(selecao.cartao, status, now);
    if (!ref) return '❌ Não consegui determinar a referência da fatura.';
    const resumo = await lancamentosService.buscarResumoFaturaCartao(userId, selecao.cartao.nome_cartao, ref.mes, ref.ano);
    const total = resumo?.total || 0;
    const { fechamento, vencimento } = calcularDatasFatura(selecao.cartao, ref.mes, ref.ano);

    if (status === 'CLOSED' && fechamento && (now.getTime() <= fechamento.getTime() || vencimento.getTime() < now.getTime())) {
      return '💳 Não há fatura fechada no momento.';
    }

    return (
      `💳 Fatura ${selecao.cartao.nome_cartao} - ${obterNomeMes(ref.mes)}/${ref.ano}\n` +
      `Status: ${status === 'OPEN' ? 'Aberta' : 'Fechada'}\n` +
      `Total: R$ ${formatarValor(total)}\n` +
      `Fecha em: ${fechamento ? formatarDiaMesAno(fechamento) : '--'}\n` +
      `Vence em: ${formatarDiaMesAno(vencimento)}`
    );
  }

  const blocos: string[] = [];
  for (const cartao of alvoCartoes) {
    const ref = hasMesAno
      ? { mes: month as number, ano: year as number }
      : calcularReferenciaFatura(cartao, status, now);

    if (!ref) continue;

    if (status === 'CLOSED' && !hasMesAno) {
      const { fechamento, vencimento } = calcularDatasFatura(cartao, ref.mes, ref.ano);
      if (!fechamento) continue;
      if (now.getTime() <= fechamento.getTime()) continue;
      if (vencimento.getTime() < now.getTime()) continue;
    }

    const resumo = await lancamentosService.buscarResumoFaturaCartao(userId, cartao.nome_cartao, ref.mes, ref.ano);
    const total = resumo?.total || 0;
    const { fechamento, vencimento } = calcularDatasFatura(cartao, ref.mes, ref.ano);

    const labelValor = hasMesAno && !parsedIntent.status ? 'Total' : (status === 'OPEN' ? 'Aberta' : 'Fechada');
    const fechamentoTexto = fechamento ? formatarDiaMes(fechamento) : '--';
    const vencTexto = formatarDiaMes(vencimento);

    blocos.push(
      `${cartao.nome_cartao}\n` +
      `${labelValor}: R$ ${formatarValor(total)}\n` +
      `Fecha em: ${fechamentoTexto}\n` +
      `Vence em: ${vencTexto}`
    );
  }

  if (blocos.length === 0) {
    if (status === 'CLOSED' && !hasMesAno) return '💳 Não há fatura fechada no momento.';
    return '💳 Não encontrei faturas para exibir.';
  }

  if (hasMesAno) {
    return `💳 Faturas ${obterNomeMes(month as number)}/${year}\n\n${blocos.join('\n\n')}`;
  }
  return `💳 Faturas atuais\n\n${blocos.join('\n\n')}`;
}

export async function handleInvoiceDetail(userId: string, parsedIntent: ParsedIntent): Promise<string> {
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    return '❌ Você ainda não tem cartões cadastrados. Digite "configurar cartao" para cadastrar.';
  }

  const selecao = selecionarCartao(cartoes, parsedIntent.cardName);
  if (!selecao.ok) return selecao.mensagem;
  if (!selecao.cartao) {
    return '❌ Para ver compras/detalhes, informe o cartão. Ex.: "ver compras itau"';
  }

  const now = new Date();
  const month = parsedIntent.month;
  const year = parsedIntent.year || (month ? now.getFullYear() : undefined);
  const ref = (month && year)
    ? { mes: month, ano: year }
    : calcularReferenciaFatura(selecao.cartao, 'OPEN', now);

  if (!ref) return '❌ Não consegui determinar a fatura para detalhar.';

  const fatura = await lancamentosService.buscarFaturaCartao(userId, selecao.cartao.nome_cartao, ref.mes, ref.ano);
  if (!fatura || fatura.length === 0) {
    return `📭 Nenhum lançamento encontrado na fatura ${selecao.cartao.nome_cartao} - ${obterNomeMes(ref.mes)}/${ref.ano}.`;
  }

  let total = 0;
  const compras = fatura.map((l: any) => {
    total += parseFloat(l.valor || 0);
    const dataLanc = l.data_lancamento || l.data || null;
    const dataBR = (dataLanc instanceof Date)
      ? dataLanc.toLocaleDateString('pt-BR')
      : (typeof dataLanc === 'string' && dataLanc.match(/^\d{4}-\d{2}-\d{2}/)
          ? new Date(dataLanc).toLocaleDateString('pt-BR')
          : String(dataLanc || '').trim());
    const desc = String(l.descricao || '').trim() || 'Compra';
    return `- ${dataBR} - ${desc} - R$ ${formatarValor(l.valor)}`;
  });

  const header =
    `💳 Detalhes da fatura ${selecao.cartao.nome_cartao} - ${obterNomeMes(ref.mes)}/${ref.ano}\n\n` +
    `Total: R$ ${formatarValor(total)}\n\n` +
    `Compras:\n`;

  return `${header}${compras.join('\n')}`;
}

export async function handleCardPaymentForecast(userId: string, parsedIntent: ParsedIntent): Promise<string> {
  const rows = await lancamentosService.buscarTotaisFaturasFuturas(userId, 6);
  if (!rows || rows.length === 0) {
    return '💳 Não encontrei próximas faturas no momento.';
  }

  const grupos = new Map<string, any[]>();
  for (const r of rows) {
    const chave = `${r.ano_fatura}-${pad2(r.mes_fatura)}`;
    const lista = grupos.get(chave) || [];
    lista.push(r);
    grupos.set(chave, lista);
  }

  const chavesOrdenadas = Array.from(grupos.keys()).sort();
  let msg = '💳 Próximas faturas\n\n';
  for (const chave of chavesOrdenadas) {
    const [anoStr, mesStr] = chave.split('-');
    const mes = parseInt(mesStr, 10);
    const ano = parseInt(anoStr, 10);
    msg += `${obterNomeMes(mes)}/${ano}\n`;
    const lista = grupos.get(chave) || [];
    for (const r of lista) {
      const dataVenc = r.data_vencimento
        ? new Date(r.data_vencimento).toLocaleDateString('pt-BR')
        : `${pad2(r.dia_vencimento || 0)}/${pad2(mes)}`;
      msg += `- ${r.cartao_nome}: R$ ${formatarValor(r.total)} - vence em ${dataVenc}\n`;
    }
    msg += '\n';
  }

  return msg.trim();
}

function isLegacyInvoiceCommand(normalized: string): boolean {
  if (/^(fatura)(\s|$)/i.test(normalized)) return true;
  if (/^(detalhar\s+fatura)(\s|$)/i.test(normalized)) return true;
  if (/^(ver\s+compras)(\s|$)/i.test(normalized)) return true;
  if (/quanto\s+vou\s+pagar\s+no\s+cart(ao|ão)/i.test(normalized)) return true;
  return false;
}

function shouldConsiderIntentLayer(normalized: string): boolean {
  if (!normalized) return false;
  if (isLegacyInvoiceCommand(normalized)) return false;
  if (/\bfatura(s)?\b/.test(normalized)) return true;
  if (/\bcompras?\b/.test(normalized)) return true;
  if (/\bpr[oó]ximas?\b/.test(normalized)) return true;
  if (/\ba pagar\b/.test(normalized)) return true;
  if (/\bquanto\b/.test(normalized) && /\bcart[aã]o\b/.test(normalized)) return true;
  if (/\bvalor\b/.test(normalized) && (/\bfatura(s)?\b/.test(normalized) || /\bcart[aã]o\b/.test(normalized))) return true;
  return false;
}

export async function routeIntent(sock: any, userId: string, message: string): Promise<boolean> {
  const originalMessage = String(message || '');
  const normalized = normalizarMensagem(originalMessage);

  if (!shouldConsiderIntentLayer(normalized)) return false;

  let parsed = parseIntentLocal(originalMessage);
  logger.info(
    { userId, intent: parsed.intent, confidence: parsed.confidence, source: parsed.source, message: originalMessage.slice(0, 200) },
    '[INTENT] local'
  );

  if (parsed.intent === 'CREATE_EXPENSE') {
    logger.info({ userId, decision: 'LEGACY', reason: 'CREATE_EXPENSE_LOCAL' }, '[INTENT] decisao');
    return false;
  }

  const isInvoiceIntent =
    parsed.intent === 'INVOICE_SUMMARY' ||
    parsed.intent === 'INVOICE_DETAIL' ||
    parsed.intent === 'CARD_PAYMENT_FORECAST';

  if (isInvoiceIntent && parsed.confidence >= 0.8) {
    const text =
      parsed.intent === 'INVOICE_SUMMARY'
        ? await handleInvoiceSummary(userId, parsed)
        : parsed.intent === 'INVOICE_DETAIL'
          ? await handleInvoiceDetail(userId, parsed)
          : await handleCardPaymentForecast(userId, parsed);

    await sock.sendMessage(userId, { text });
    logger.info({ userId, decision: 'HANDLED', source: parsed.source, intent: parsed.intent, confidence: parsed.confidence }, '[INTENT] decisao');
    return true;
  }

  parsed = await classifyIntentWithGemini(originalMessage);
  logger.info(
    { userId, intent: parsed.intent, confidence: parsed.confidence, source: parsed.source, message: originalMessage.slice(0, 200) },
    '[INTENT] gemini'
  );

  if (parsed.intent === 'CREATE_EXPENSE') {
    logger.info({ userId, decision: 'LEGACY', reason: 'CREATE_EXPENSE_GEMINI', confidence: parsed.confidence }, '[INTENT] decisao');
    return false;
  }

  const isInvoiceIntentGemini =
    parsed.intent === 'INVOICE_SUMMARY' ||
    parsed.intent === 'INVOICE_DETAIL' ||
    parsed.intent === 'CARD_PAYMENT_FORECAST';

  if (isInvoiceIntentGemini && parsed.confidence >= 0.75) {
    const text =
      parsed.intent === 'INVOICE_SUMMARY'
        ? await handleInvoiceSummary(userId, parsed)
        : parsed.intent === 'INVOICE_DETAIL'
          ? await handleInvoiceDetail(userId, parsed)
          : await handleCardPaymentForecast(userId, parsed);

    await sock.sendMessage(userId, { text });
    logger.info({ userId, decision: 'HANDLED', source: parsed.source, intent: parsed.intent, confidence: parsed.confidence }, '[INTENT] decisao');
    return true;
  }

  logger.info({ userId, decision: 'LEGACY', reason: 'UNKNOWN_OR_LOW_CONF', intent: parsed.intent, confidence: parsed.confidence }, '[INTENT] decisao');
  return false;
}
