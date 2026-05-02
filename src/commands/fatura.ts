// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import * as cartoesService from '../services/cartoesService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';
import { logger } from '../infrastructure/logger';

type FaturaCommandType = 'INVOICE_SUMMARY' | 'INVOICE_DETAIL' | 'CARD_PAYMENT_FORECAST';
type FaturaStatus = 'OPEN' | 'CLOSED';

type ParsedFaturaCommand = {
  type: FaturaCommandType;
  cardName?: string;
  month?: number;
  year?: number;
  status?: FaturaStatus;
};

function removerAcentos(texto: string): string {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarTexto(texto: string): string {
  return removerAcentos(String(texto || '')).toLowerCase().trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatarDiaMes(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

function formatarDiaMesAno(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

const MES_POR_PALAVRA: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12
};

function extrairMesAnoECartao(tokens: string[]): { cardName?: string; month?: number; year?: number } {
  let month: number | undefined;
  let year: number | undefined;
  const manter: string[] = [];

  const cleanedTokens = tokens
    .map(t => t.trim())
    .filter(Boolean);

  for (let i = 0; i < cleanedTokens.length; i++) {
    const t = cleanedTokens[i];
    const n = normalizarTexto(t).replace(/[^a-z0-9\/\-]/g, '');

    const mmYyyy = n.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
    if (mmYyyy && month === undefined) {
      const mm = parseInt(mmYyyy[1], 10);
      let yy = parseInt(mmYyyy[2], 10);
      if (yy < 100) yy += 2000;
      if (mm >= 1 && mm <= 12) {
        month = mm;
        year = yy;
        continue;
      }
    }

    const mes = MES_POR_PALAVRA[n];
    if (mes && month === undefined) {
      month = mes;
      const prox = cleanedTokens[i + 1];
      if (prox) {
        const proxNorm = normalizarTexto(prox).replace(/[^0-9]/g, '');
        if (/^\d{2,4}$/.test(proxNorm)) {
          let yy = parseInt(proxNorm, 10);
          if (yy < 100) yy += 2000;
          year = yy;
          i++;
        }
      }
      continue;
    }

    if (/^\d{2,4}$/.test(n) && year === undefined && month !== undefined) {
      let yy = parseInt(n, 10);
      if (yy < 100) yy += 2000;
      year = yy;
      continue;
    }

    manter.push(t);
  }

  const cardName = manter.join(' ').trim() || undefined;
  return { cardName, month, year };
}

function parseFaturaCommand(texto: string): ParsedFaturaCommand | null {
  const raw = String(texto || '').trim();
  const n = normalizarTexto(raw);
  if (!n) return null;

  const isForecast = n.includes('quanto vou pagar') && n.includes('cartao');
  if (isForecast) {
    return { type: 'CARD_PAYMENT_FORECAST' };
  }

  const status: FaturaStatus | undefined =
    /\bfechad[ao]\b/.test(n) ? 'CLOSED'
    : (/\babert[ao]\b/.test(n) || n.includes('em aberto') || n.includes('atual')) ? 'OPEN'
    : undefined;

  const tokens = raw.split(/\s+/);
  const tokensNorm = tokens.map(t => normalizarTexto(t));

  const startsWith = (a: string[]) => a.every((v, idx) => tokensNorm[idx] === v);

  let type: FaturaCommandType | null = null;
  let startIdx = 0;

  if (startsWith(['detalhar', 'fatura'])) {
    type = 'INVOICE_DETAIL';
    startIdx = 2;
  } else if (startsWith(['ver', 'compras'])) {
    type = 'INVOICE_DETAIL';
    startIdx = 2;
  } else if (tokensNorm[0] === 'fatura') {
    type = 'INVOICE_SUMMARY';
    startIdx = 1;
  }

  if (!type) return null;

  const restoTokens = tokens
    .slice(startIdx)
    .filter(t => t && !['da', 'do', 'de', 'no', 'na', 'dos', 'das', 'em'].includes(normalizarTexto(t)));
  const restoSemStatus = restoTokens.filter(t => !['aberta', 'aberto', 'abertas', 'abertos', 'fechada', 'fechado', 'fechadas', 'fechados', 'atual'].includes(normalizarTexto(t)));
  const { cardName, month, year } = extrairMesAnoECartao(restoSemStatus);

  const parsed: ParsedFaturaCommand = {
    type,
    cardName,
    month,
    year,
    status
  };

  const fallbackMesAno = (!month && !year && restoSemStatus.length > 0)
    ? parseMesAno(restoSemStatus.join(' '))
    : null;

  if (fallbackMesAno && !parsed.month) {
    parsed.month = fallbackMesAno.mes;
    parsed.year = fallbackMesAno.ano;
  }

  return parsed;
}

function escolherCartoes(cartoes: any[], cardName?: string): { ok: true; cartoes: any[] } | { ok: false; mensagem: string } {
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
    return {
      ok: false,
      mensagem: formatarMensagem({
        titulo: 'Cartão não encontrado',
        emojiTitulo: '❌',
        secoes: [
          {
            titulo: 'Solução',
            itens: [
              `Não encontrei o cartão "${cardName}".`,
              'Confira o nome com "cartoes" e tente novamente.'
            ],
            emoji: '💳'
          }
        ],
        dicas: [
          { texto: 'Ver cartões cadastrados', comando: 'cartoes' },
          { texto: 'Exemplo', comando: 'fatura nubank abril' }
        ]
      })
    };
  }

  const topScore = candidatos[0].score;
  const tops = candidatos.filter(c => c.score === topScore);
  if (tops.length > 1) {
    return {
      ok: false,
      mensagem: formatarMensagem({
        titulo: 'Mais de um cartão encontrado',
        emojiTitulo: '⚠️',
        secoes: [
          {
            titulo: 'Escolha um',
            itens: tops.map(c => c.cartao.nome_cartao),
            emoji: '💳'
          }
        ],
        dicas: [
          { texto: 'Exemplo', comando: `fatura ${tops[0].cartao.nome_cartao} abril` }
        ]
      })
    };
  }

  return { ok: true, cartoes: [tops[0].cartao] };
}

function calcularReferenciaFatura(cartao: any, status: FaturaStatus, now: Date): { mes: number; ano: number } | null {
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

function obterNomeMes(mes: number): string {
  return getNomeMes(mes - 1);
}

async function renderizarResumoFaturas(sock, userId, cartoes: any[], opts: { month?: number; year?: number; status?: FaturaStatus; titulo?: string; mostrarAnoNasDatas?: boolean }) {
  const now = new Date();
  const status = opts.status;
  const month = opts.month;
  const year = opts.year;
  const mostrarAnoNasDatas = opts.mostrarAnoNasDatas ?? false;
  const hasMesAno = !!(month && year);
  const statusParaReferencia: FaturaStatus = status || 'OPEN';

  const blocos: string[] = [];
  for (const cartao of cartoes) {
    const ref = hasMesAno
      ? { mes: month, ano: year }
      : calcularReferenciaFatura(cartao, statusParaReferencia, now);

    if (!ref) continue;

    if (status === 'CLOSED') {
      const { fechamento, vencimento } = calcularDatasFatura(cartao, ref.mes, ref.ano);
      if (!fechamento) continue;
      if (now.getTime() <= fechamento.getTime()) continue;
      if (vencimento.getTime() < now.getTime()) continue;
    }

    const resumo = await lancamentosService.buscarResumoFaturaCartao(userId, cartao.nome_cartao, ref.mes, ref.ano);
    const total = resumo?.total || 0;
    const { fechamento, vencimento } = calcularDatasFatura(cartao, ref.mes, ref.ano);

    const statusTexto = (hasMesAno && !status) ? 'Total' : (statusParaReferencia === 'OPEN' ? 'Aberta' : 'Fechada');
    const fechamentoTexto = fechamento
      ? (mostrarAnoNasDatas ? formatarDiaMesAno(fechamento) : formatarDiaMes(fechamento))
      : '--';
    const vencimentoTexto = mostrarAnoNasDatas ? formatarDiaMesAno(vencimento) : formatarDiaMes(vencimento);

    blocos.push(
      `${cartao.nome_cartao}\n` +
      `${statusTexto}: R$ ${formatarValor(total)}\n` +
      `Fecha em: ${fechamentoTexto}\n` +
      `Vence em: ${vencimentoTexto}`
    );
  }

  if (blocos.length === 0) {
    await sock.sendMessage(userId, {
      text: status === 'CLOSED'
        ? '💳 Não há fatura fechada para pagar no momento.'
        : '💳 Não encontrei faturas para exibir.'
    });
    return;
  }

  const titulo = opts.titulo || (statusParaReferencia === 'OPEN' ? '💳 Faturas atuais' : '💳 Próximas faturas fechadas');
  await sock.sendMessage(userId, { text: `${titulo}\n\n${blocos.join('\n\n')}` });
}

async function renderizarProximaFaturaFechada(sock, userId, cartoes: any[]) {
  const now = new Date();
  const candidatos: any[] = [];

  for (const cartao of cartoes) {
    const ref = calcularReferenciaFatura(cartao, 'CLOSED', now);
    if (!ref) continue;

    const { fechamento, vencimento } = calcularDatasFatura(cartao, ref.mes, ref.ano);
    if (!fechamento) continue;
    if (now.getTime() <= fechamento.getTime()) continue;
    if (vencimento.getTime() < now.getTime()) continue;

    const resumo = await lancamentosService.buscarResumoFaturaCartao(userId, cartao.nome_cartao, ref.mes, ref.ano);
    const total = resumo?.total || 0;

    candidatos.push({ cartao, ref, fechamento, vencimento, total });
  }

  if (candidatos.length === 0) {
    await sock.sendMessage(userId, { text: '💳 Não há fatura fechada no momento.' });
    return;
  }

  candidatos.sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime());
  const c = candidatos[0];
  const nomeMes = obterNomeMes(c.ref.mes);

  const msg =
    `💳 Fatura ${c.cartao.nome_cartao} - ${nomeMes}/${c.ref.ano}\n` +
    `Status: Fechada\n` +
    `Total: R$ ${formatarValor(c.total)}\n` +
    `Fecha em: ${c.fechamento ? formatarDiaMesAno(c.fechamento) : '--'}\n` +
    `Vence em: ${formatarDiaMesAno(c.vencimento)}`;

  await sock.sendMessage(userId, { text: msg });
}

async function renderizarResumoFaturaCartao(sock, userId, cartao: any, month?: number, year?: number, status?: FaturaStatus) {
  const now = new Date();
  const resolvedStatus = status || 'OPEN';

  const ref = (month && year)
    ? { mes: month, ano: year }
    : calcularReferenciaFatura(cartao, resolvedStatus, now);

  if (!ref) {
    await sock.sendMessage(userId, { text: '❌ Não consegui determinar a referência da fatura.' });
    return;
  }

  const resumo = await lancamentosService.buscarResumoFaturaCartao(userId, cartao.nome_cartao, ref.mes, ref.ano);
  const total = resumo?.total || 0;
  const { fechamento, vencimento } = calcularDatasFatura(cartao, ref.mes, ref.ano);

  if (resolvedStatus === 'CLOSED' && !(month && year)) {
    if (!fechamento || now.getTime() <= fechamento.getTime() || vencimento.getTime() < now.getTime()) {
      await sock.sendMessage(userId, { text: '💳 Não há fatura fechada no momento.' });
      return;
    }
  }

  let statusTexto = resolvedStatus === 'OPEN' ? 'Aberta' : 'Fechada';
  if (month && year && !status) {
    const refAberta = calcularReferenciaFatura(cartao, 'OPEN', now);
    const refFechada = calcularReferenciaFatura(cartao, 'CLOSED', now);
    if (refAberta && refAberta.mes === ref.mes && refAberta.ano === ref.ano) statusTexto = 'Aberta';
    else if (refFechada && refFechada.mes === ref.mes && refFechada.ano === ref.ano) statusTexto = 'Fechada';
    else statusTexto = '—';
  }

  const nomeMes = obterNomeMes(ref.mes);
  const msg =
    `💳 Fatura ${cartao.nome_cartao} - ${nomeMes}/${ref.ano}\n` +
    `Status: ${statusTexto}\n` +
    `Total: R$ ${formatarValor(total)}\n` +
    `Fecha em: ${fechamento ? formatarDiaMesAno(fechamento) : '--'}\n` +
    `Vence em: ${formatarDiaMesAno(vencimento)}`;

  await sock.sendMessage(userId, { text: msg });
}

async function renderizarDetalheFatura(sock, userId, cartao: any, month?: number, year?: number) {
  const now = new Date();
  const ref = (month && year)
    ? { mes: month, ano: year }
    : calcularReferenciaFatura(cartao, 'OPEN', now);

  if (!ref) {
    await sock.sendMessage(userId, { text: '❌ Não consegui determinar a fatura para detalhar.' });
    return;
  }

  const fatura = await lancamentosService.buscarFaturaCartao(userId, cartao.nome_cartao, ref.mes, ref.ano);
  const nomeMes = obterNomeMes(ref.mes);

  if (!fatura || fatura.length === 0) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Nenhum lançamento encontrado',
        emojiTitulo: '📭',
        secoes: [
          {
            titulo: 'Detalhes',
            itens: [
              `Cartão: ${cartao.nome_cartao}`,
              `Período: ${nomeMes}/${ref.ano}`
            ],
            emoji: '💳'
          }
        ],
        dicas: [
          { texto: 'Ver fatura aberta', comando: `fatura ${cartao.nome_cartao}` },
          { texto: 'Ver histórico geral', comando: 'historico' }
        ]
      })
    });
    return;
  }

  let total = 0;
  const compras = fatura.map(l => {
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
    `💳 Detalhes da fatura ${cartao.nome_cartao} - ${nomeMes}/${ref.ano}\n\n` +
    `Total: R$ ${formatarValor(total)}\n\n` +
    `Compras:\n`;

  const MAX_ITENS_POR_MENSAGEM = 35;
  const totalPartes = Math.max(1, Math.ceil(compras.length / MAX_ITENS_POR_MENSAGEM));
  for (let parte = 0; parte < totalPartes; parte++) {
    const inicio = parte * MAX_ITENS_POR_MENSAGEM;
    const fim = inicio + MAX_ITENS_POR_MENSAGEM;
    const chunk = compras.slice(inicio, fim).join('\n');
    const tituloParte = totalPartes > 1 ? ` (${parte + 1}/${totalPartes})` : '';
    await sock.sendMessage(userId, { text: (parte === 0 ? `${header}${chunk}` : `💳 Compras${tituloParte}\n\n${chunk}`) });
  }
}

async function renderizarFaturaLegacy(sock, userId, cartao: any, mes: number, ano: number) {
  const fatura = await lancamentosService.buscarFaturaCartao(userId, cartao.nome_cartao, mes, ano);
  const nomeMesFatura = obterNomeMes(mes);

  if (!fatura || fatura.length === 0) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Nenhum lançamento encontrado',
        emojiTitulo: '📭',
        secoes: [
          {
            titulo: 'Detalhes',
            itens: [
              `Cartão: ${cartao.nome_cartao}`,
              `Período: ${nomeMesFatura}/${ano}`
            ],
            emoji: '💳'
          }
        ],
        dicas: [
          { texto: 'Verificar nome do cartão', comando: 'cartoes' },
          { texto: 'Ver histórico geral', comando: 'historico' }
        ]
      })
    });
    return;
  }

  let total = 0;
  const itensFatura = fatura.map(l => {
    const dataLanc = l.data_lancamento || l.data || null;
    const dataBR = (dataLanc instanceof Date)
      ? dataLanc.toLocaleDateString('pt-BR')
      : (typeof dataLanc === 'string' && dataLanc.match(/^\d{4}-\d{2}-\d{2}/)
          ? new Date(dataLanc).toLocaleDateString('pt-BR')
          : String(dataLanc || '').trim());
    total += parseFloat(l.valor);
    return `${dataBR} - ${l.descricao} - R$ ${formatarValor(l.valor)}`;
  });

  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: `Fatura ${cartao.nome_cartao} ${nomeMesFatura}/${ano}`,
      emojiTitulo: '💳',
      secoes: [
        {
          titulo: 'Lançamentos',
          itens: itensFatura,
          emoji: '📊'
        },
        {
          titulo: 'Resumo',
          itens: [`Total: R$ ${formatarValor(total)}`],
          emoji: '💰'
        }
      ],
      dicas: [
        { texto: 'Ver fatura de outro mês', comando: `fatura ${cartao.nome_cartao} 08/${ano}` },
        { texto: 'Ver histórico geral', comando: 'historico' }
      ]
    })
  });
}

async function renderizarPrevisaoFaturas(sock, userId) {
  const rows = await lancamentosService.buscarTotaisFaturasFuturas(userId, 6);
  if (!rows || rows.length === 0) {
    await sock.sendMessage(userId, { text: '💳 Não encontrei próximas faturas no momento.' });
    return;
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
    const tituloMes = `${obterNomeMes(mes)}/${ano}`;
    msg += `${tituloMes}\n`;
    const lista = grupos.get(chave) || [];
    for (const r of lista) {
      const dataVenc = r.data_vencimento
        ? new Date(r.data_vencimento).toLocaleDateString('pt-BR')
        : `${pad2(r.dia_vencimento || 0)}/${pad2(mes)}`;
      msg += `- ${r.cartao_nome}: R$ ${formatarValor(r.total)} - vence em ${dataVenc}\n`;
    }
    msg += '\n';
  }

  await sock.sendMessage(userId, { text: msg.trim() });
}

async function faturaCommand(sock, userId, texto) {
  const parsed = parseFaturaCommand(texto);
  logger.debug?.({ texto: String(texto || '').slice(0, 200), parsed }, '[FATURA] interpretacao');

  if (!parsed) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.FORMATO_INVALIDO(
        'Comando de fatura',
        'fatura nubank abril',
        'fatura, fatura aberta, fatura fechada, fatura nubank abril, detalhar fatura nubank, quanto vou pagar no cartão?'
      )
    });
    return;
  }

  if (parsed.type === 'CARD_PAYMENT_FORECAST') {
    await renderizarPrevisaoFaturas(sock, userId);
    return;
  }

  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Nenhum cartão cadastrado',
        emojiTitulo: '❌',
        secoes: [
          {
            titulo: 'Como resolver',
            itens: ['Cadastre seu cartão para começar a acompanhar faturas.'],
            emoji: '💳'
          }
        ],
        dicas: [{ texto: 'Cadastrar cartão', comando: 'configurar cartao' }]
      })
    });
    return;
  }

  const selecao = escolherCartoes(cartoes, parsed.cardName);
  if (!selecao.ok) {
    await sock.sendMessage(userId, { text: selecao.mensagem });
    return;
  }

  const anoAtual = new Date().getFullYear();
  const month = parsed.month;
  const year = parsed.year || (month ? anoAtual : undefined);
  const textoNorm = normalizarTexto(texto);

  if (parsed.type === 'INVOICE_SUMMARY' && textoNorm.startsWith('fatura') && parsed.cardName && month && year && selecao.cartoes.length === 1) {
    await renderizarFaturaLegacy(sock, userId, selecao.cartoes[0], month, year);
    return;
  }

  if (parsed.type === 'INVOICE_DETAIL') {
    if (selecao.cartoes.length !== 1) {
      await sock.sendMessage(userId, { text: '❌ Para detalhar a fatura, informe o cartão. Ex.: detalhar fatura nubank' });
      return;
    }
    await renderizarDetalheFatura(sock, userId, selecao.cartoes[0], month, year);
    return;
  }

  const status = parsed.status || 'OPEN';

  if (selecao.cartoes.length === 1 && (parsed.cardName || month)) {
    const cartao = selecao.cartoes[0];
    await renderizarResumoFaturaCartao(sock, userId, cartao, month, year, parsed.status);
    return;
  }

  if (month) {
    const nomeMes = obterNomeMes(month);
    await renderizarResumoFaturas(sock, userId, selecao.cartoes, {
      month,
      year,
      status: parsed.status,
      titulo: `💳 Faturas ${nomeMes}/${year}`,
      mostrarAnoNasDatas: false
    });
    return;
  }

  if (status === 'CLOSED') {
    if (selecao.cartoes.length === 1) {
      await renderizarResumoFaturaCartao(sock, userId, selecao.cartoes[0], undefined, undefined, 'CLOSED');
      return;
    }
    await renderizarProximaFaturaFechada(sock, userId, selecao.cartoes);
    return;
  }

  await renderizarResumoFaturas(sock, userId, selecao.cartoes, {
    status: 'OPEN',
    titulo: '💳 Faturas atuais',
    mostrarAnoNasDatas: false
  });
}

export default faturaCommand;
