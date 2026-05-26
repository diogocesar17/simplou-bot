import { formatarValor } from '../utils/formatUtils';
import * as driverService from '../services/driverService';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
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

function totalEfetivoMensal(custos: driverService.FixedCost[]): number {
  return custos.reduce((sum, c) => {
    return sum + (c.recurrence === 'MONTHLY' ? c.amount : c.amount / 12);
  }, 0);
}

const BOTAO_CANCELAR = [{ id: 'cancelar_custo', title: '❌ Cancelar' }];
const isCancelar = (t: string) => ['cancelar_custo', 'cancelar', '0'].includes(t.toLowerCase().trim());

// ─── Lista interativa ──────────────────────────────────────────────────────

async function listarCustosFixosInterativos(sock: any, userId: string): Promise<void> {
  const custos = await driverService.getFixedCosts(userId);

  if (custos.length === 0) {
    await definirEstado(userId, 'aguardando_acao_custo_fixo', {});
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '📋 Custos fixos mensais',
      body:
        'Você ainda não tem custos fixos cadastrados.\n\n' +
        'Cadastre financiamento, seguro, celular e outros gastos recorrentes — eles serão descontados automaticamente no cálculo do seu lucro real.',
      buttons: [{ id: 'adicionar', title: '➕ Adicionar' }],
    });
    return;
  }

  const total = totalEfetivoMensal(custos);
  const bodyLines = custos
    .map(c => `• ${c.description}: R$ ${formatarValor(c.amount)}${c.recurrence === 'MONTHLY' ? '/mês' : '/ano'}`)
    .join('\n');

  const sections: any[] = custos.map(c => ({
    title: c.description.substring(0, 24),
    rows: [{
      id: `remover_${c.id}`,
      title: '🗑️ Remover',
      description: `R$ ${formatarValor(c.amount)}${c.recurrence === 'MONTHLY' ? '/mês' : '/ano'}`,
    }],
  }));

  sections.push({
    title: 'Adicionar',
    rows: [{
      id: 'adicionar',
      title: '➕ Novo custo fixo',
      description: 'Cadastrar custo mensal ou anual',
    }],
  });

  await definirEstado(userId, 'aguardando_acao_custo_fixo', {});
  await sock.sendInteractiveMessage(userId, {
    type: 'list',
    header: '📋 Seus custos fixos',
    body: `${bodyLines}\n\n💸 Total efetivo mensal: R$ ${formatarValor(total)}`,
    buttonLabel: 'Gerenciar',
    sections,
  });
}

// ─── Handlers de estado ───────────────────────────────────────────────────────

async function handleAcaoCustoFixo(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().trim();

  if (norm === 'adicionar') {
    await definirEstado(userId, 'custo_fixo_descricao', {});
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '📋 Novo custo fixo — 1/3',
      body: 'Qual é o nome desse custo?\n\nEx: Seguro auto, Financiamento, Internet, Aluguel',
      buttons: BOTAO_CANCELAR,
    });
    return;
  }

  if (norm.startsWith('remover_')) {
    const id = texto.trim().replace(/^remover_/i, '');
    const custos = await driverService.getFixedCosts(userId);
    const custo = custos.find(c => c.id === id);
    if (!custo) {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '⚠️ Custo não encontrado.' });
      return;
    }
    const freq = custo.recurrence === 'MONTHLY' ? '/mês' : '/ano';
    await definirEstado(userId, 'confirmando_remocao_custo_fixo', { id: custo.id, description: custo.description });
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: `🗑️ ${custo.description.substring(0, 50)}`,
      body: `Remover R$ ${formatarValor(custo.amount)}${freq} dos seus custos fixos?`,
      buttons: [
        { id: '1', title: '✅ Confirmar' },
        { id: '2', title: '❌ Cancelar' },
      ],
    });
    return;
  }

  await limparEstado(userId);
}

async function handleConfirmarRemocao(sock: any, userId: string, texto: string, id: string, description: string): Promise<void> {
  const norm = texto.toLowerCase().trim();
  if (norm === '1' || norm === 'confirmar') {
    await driverService.removeFixedCost(userId, id);
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: `✅ *${description}* removido dos custos fixos.` });
    return;
  }
  await limparEstado(userId);
  await sock.sendMessage(userId, { text: '↩️ Remoção cancelada.' });
}

async function handleDescricao(sock: any, userId: string, texto: string): Promise<void> {
  if (isCancelar(texto)) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '↩️ Cadastro cancelado.' });
    return;
  }
  const descricao = texto.trim();
  if (descricao.length < 2) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '📋 Novo custo fixo — 1/3',
      body: 'Nome muito curto. Informe um nome para o custo (ex: Seguro auto):',
      buttons: BOTAO_CANCELAR,
    });
    return;
  }
  await definirEstado(userId, 'custo_fixo_valor', { descricao });
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '📋 Novo custo fixo — 2/3',
    body: `*${descricao}*\n\nQual é o valor?\n\nEx: _250_ para R$ 250`,
    buttons: BOTAO_CANCELAR,
  });
}

async function handleValor(sock: any, userId: string, texto: string, descricao: string): Promise<void> {
  if (isCancelar(texto)) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '↩️ Cadastro cancelado.' });
    return;
  }
  const valor = extrairValor(normalizar(texto));
  if (!valor) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '📋 Novo custo fixo — 2/3',
      body: `*${descricao}*\n\nValor inválido. Informe um número (ex: _250_):`,
      buttons: BOTAO_CANCELAR,
    });
    return;
  }
  await definirEstado(userId, 'custo_fixo_frequencia', { descricao, valor });
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '📋 Novo custo fixo — 3/3',
    body: `*${descricao}* — R$ ${formatarValor(valor)}\n\nCom que frequência é esse custo?`,
    buttons: [
      { id: 'mensal', title: '📅 Mensal' },
      { id: 'anual', title: '📆 Anual' },
    ],
  });
}

async function handleFrequencia(sock: any, userId: string, texto: string, descricao: string, valor: number): Promise<void> {
  const norm = texto.toLowerCase().trim();

  if (isCancelar(norm)) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '↩️ Cadastro cancelado.' });
    return;
  }

  let recurrence: 'MONTHLY' | 'YEARLY' | null = null;
  if (norm === 'mensal' || /\bpor\s+mes\b|\bmensal\b/.test(norm)) recurrence = 'MONTHLY';
  else if (norm === 'anual' || /\bpor\s+ano\b|\banual\b/.test(norm)) recurrence = 'YEARLY';

  if (!recurrence) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '📋 Novo custo fixo — 3/3',
      body: `*${descricao}* — R$ ${formatarValor(valor)}\n\nCom que frequência é esse custo?`,
      buttons: [
        { id: 'mensal', title: '📅 Mensal' },
        { id: 'anual', title: '📆 Anual' },
      ],
    });
    return;
  }

  const categoria = detectarCategoria(normalizar(descricao));
  await driverService.addFixedCost(userId, descricao, categoria, valor, recurrence);
  await limparEstado(userId);

  const freqLabel = recurrence === 'MONTHLY' ? '/mês' : '/ano';
  const mensalEquiv = recurrence === 'YEARLY' ? valor / 12 : null;

  let msg = `✅ *Custo fixo cadastrado!*\n\n📝 ${descricao}\n💸 R$ ${formatarValor(valor)}${freqLabel}`;
  if (mensalEquiv) msg += `\n📊 Equivale a R$ ${formatarValor(mensalEquiv)}/mês`;
  msg += `\n\nJá será descontado no cálculo do seu lucro real.\nPara ver todos: "custos fixos"`;

  await sock.sendMessage(userId, { text: msg });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function custoFixoCommand(sock: any, userId: string, texto: string): Promise<void> {
  const norm = normalizar(texto);

  try {
    const estado = await obterEstado(userId);

    // Despachar para handler do estado ativo
    if (estado?.etapa === 'aguardando_acao_custo_fixo') {
      return await handleAcaoCustoFixo(sock, userId, texto);
    }
    if (estado?.etapa === 'confirmando_remocao_custo_fixo') {
      const { id, description } = estado.dadosParciais as any;
      return await handleConfirmarRemocao(sock, userId, texto, id, description);
    }
    if (estado?.etapa === 'custo_fixo_descricao') {
      return await handleDescricao(sock, userId, texto);
    }
    if (estado?.etapa === 'custo_fixo_valor') {
      const { descricao } = estado.dadosParciais as any;
      return await handleValor(sock, userId, texto, descricao);
    }
    if (estado?.etapa === 'custo_fixo_frequencia') {
      const { descricao, valor } = estado.dadosParciais as any;
      return await handleFrequencia(sock, userId, texto, descricao, valor);
    }

    // Sem estado ativo — comandos de texto

    // Ver lista
    if (['custos fixos', 'custo fixo', 'ver custos fixos', 'meus custos fixos'].includes(norm)) {
      return await listarCustosFixosInterativos(sock, userId);
    }

    // Cadastro rápido por texto ("meu seguro custa 250 por mês")
    const valor = extrairValor(norm);
    if (valor) {
      const recurrence: 'MONTHLY' | 'YEARLY' = /\bpor\s+ano\b|\banual\b/.test(norm) ? 'YEARLY' : 'MONTHLY';
      const categoria = detectarCategoria(norm);
      const descMatch = norm.match(/\b(?:meu|minha|o|a)\s+([a-z\s]{3,30})\s+(?:custa|e|eh|vale)\b/);
      const descPago = norm.match(/\bpago\s+[\d.,]+.*?\bde\s+([a-z\s]{3,30})\b/);
      const descricao = (descMatch?.[1] || descPago?.[1] || categoria).trim();
      const freqLabel = recurrence === 'MONTHLY' ? '/mês' : '/ano';

      await driverService.addFixedCost(userId, descricao, categoria, valor, recurrence);
      await sock.sendMessage(userId, {
        text:
          `✅ Custo fixo cadastrado:\n` +
          `📝 ${descricao} (${categoria})\n` +
          `💸 R$ ${formatarValor(valor)}${freqLabel}\n\n` +
          `Já será descontado no cálculo do lucro real.\nPara ver todos: "custos fixos"`,
      });
      return;
    }

    // Fallback: mostrar lista
    return await listarCustosFixosInterativos(sock, userId);
  } catch (err) {
    logger.error({ err }, '[CUSTO_FIXO] Erro');
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '❌ Erro ao processar. Tente novamente.' });
  }
}
