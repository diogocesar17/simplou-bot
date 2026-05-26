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

function extrairValorMeta(norm: string): number | null {
  const match = norm.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+)/);
  if (!match) return null;
  let s = match[1].replace(',', '.');
  const v = parseFloat(s);
  return isNaN(v) || v <= 0 ? null : v;
}

function detectarTipoMeta(norm: string): 'DIARIA' | 'SEMANAL' | 'MENSAL' | null {
  if (/\b(diaria|diario|por dia|dia)\b/.test(norm)) return 'DIARIA';
  if (/\b(semanal|semana|por semana)\b/.test(norm)) return 'SEMANAL';
  if (/\b(mensal|mes|por mes|mensalmente)\b/.test(norm)) return 'MENSAL';
  return null;
}

function labelMeta(tipo: 'DIARIA' | 'SEMANAL' | 'MENSAL'): string {
  return tipo === 'DIARIA' ? 'diária' : tipo === 'SEMANAL' ? 'semanal' : 'mensal';
}

const LABEL_DESC: Record<string, string> = {
  DIARIA: 'Ex: R$ 300 por dia',
  SEMANAL: 'Ex: R$ 1.500/semana',
  MENSAL: 'Ex: R$ 6.000/mês',
};

const TIPOS_VALIDOS = ['DIARIA', 'SEMANAL', 'MENSAL'] as const;
type TipoMeta = typeof TIPOS_VALIDOS[number];

function isTipoValido(s: string): s is TipoMeta {
  return TIPOS_VALIDOS.includes(s as TipoMeta);
}

// ─── Mostrar metas com lista interativa ───────────────────────────────────────

async function mostrarMetasInterativas(sock: any, userId: string): Promise<void> {
  const metas = await driverService.getGoals(userId);
  const tiposDefinidos = new Set(metas.map(m => m.tipo_meta));
  const tiposNaoDefinidos = TIPOS_VALIDOS.filter(t => !tiposDefinidos.has(t));

  const sections: any[] = [];

  for (const m of metas) {
    sections.push({
      title: `Meta ${labelMeta(m.tipo_meta)}`,
      rows: [
        { id: `alterar_${m.tipo_meta}`, title: '✏️ Alterar', description: `Atual: R$ ${formatarValor(m.valor)}` },
        { id: `remover_${m.tipo_meta}`, title: '🗑️ Remover', description: `Desativar meta ${labelMeta(m.tipo_meta)}` },
      ],
    });
  }

  if (tiposNaoDefinidos.length > 0) {
    sections.push({
      title: metas.length > 0 ? 'Adicionar meta' : 'Definir meta',
      rows: tiposNaoDefinidos.map(t => ({
        id: `adicionar_${t}`,
        title: `➕ ${labelMeta(t).charAt(0).toUpperCase() + labelMeta(t).slice(1)}`,
        description: LABEL_DESC[t],
      })),
    });
  }

  const bodyLines = metas.length > 0
    ? metas.map(m => `• Meta ${labelMeta(m.tipo_meta)}: R$ ${formatarValor(m.valor)}`).join('\n')
    : 'Nenhuma meta definida ainda.';

  await definirEstado(userId, 'aguardando_acao_meta', {});
  await sock.sendInteractiveMessage(userId, {
    type: 'list',
    header: '🎯 Suas metas',
    body: bodyLines,
    buttonLabel: 'Gerenciar',
    sections,
  });
}

// ─── Handlers de estado ───────────────────────────────────────────────────────

async function handleMetaAcao(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().trim();

  const acao = norm.startsWith('alterar_') ? 'alterar'
    : norm.startsWith('adicionar_') ? 'adicionar'
    : norm.startsWith('remover_') ? 'remover'
    : null;

  if (!acao) {
    await limparEstado(userId);
    return;
  }

  const tipoRaw = norm.replace(/^(alterar_|adicionar_|remover_)/, '').toUpperCase();
  if (!isTipoValido(tipoRaw)) {
    await limparEstado(userId);
    return;
  }
  const tipo = tipoRaw as TipoMeta;

  if (acao === 'alterar' || acao === 'adicionar') {
    await definirEstado(userId, 'aguardando_novo_valor_meta', { tipo });
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: `🎯 Meta ${labelMeta(tipo)}`,
      body: `Qual será o valor da sua meta ${labelMeta(tipo)}?\n\nEx: _300_ para R$ 300`,
      buttons: [{ id: 'cancelar_meta', title: '❌ Cancelar' }],
    });
    return;
  }

  if (acao === 'remover') {
    const meta = await driverService.getGoal(userId, tipo);
    if (!meta) {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: `⚠️ Meta ${labelMeta(tipo)} não encontrada.` });
      return;
    }
    await definirEstado(userId, 'confirmando_remocao_meta', { tipo });
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: `🗑️ Remover meta ${labelMeta(tipo)}`,
      body: `Confirmar remoção da meta ${labelMeta(tipo)} de R$ ${formatarValor(meta.valor)}?`,
      buttons: [
        { id: '1', title: '✅ Confirmar' },
        { id: '2', title: '❌ Cancelar' },
      ],
    });
  }
}

async function handleNovoValorMeta(sock: any, userId: string, texto: string, tipo: TipoMeta): Promise<void> {
  const norm = normalizar(texto);

  if (norm === 'cancelar_meta' || norm === 'cancelar' || norm === '0') {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '↩️ Alteração cancelada.' });
    return;
  }

  const valor = extrairValorMeta(norm);
  if (!valor) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: `🎯 Meta ${labelMeta(tipo)}`,
      body: 'Valor inválido. Informe um número (ex: _300_):',
      buttons: [{ id: 'cancelar_meta', title: '❌ Cancelar' }],
    });
    return;
  }

  await driverService.upsertGoal(userId, tipo, valor);
  await limparEstado(userId);
  await sock.sendMessage(userId, {
    text:
      `✅ Meta ${labelMeta(tipo)} definida: *R$ ${formatarValor(valor)}*\n\n` +
      `A cada lançamento, vou comparar seu lucro com essa meta.\n` +
      `Para ver o progresso: _quanto falta para a meta_`,
  });
}

async function handleConfirmarRemocao(sock: any, userId: string, texto: string, tipo: TipoMeta): Promise<void> {
  const norm = texto.toLowerCase().trim();

  if (norm === '1' || norm === 'confirmar') {
    await driverService.removeGoal(userId, tipo);
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: `✅ Meta ${labelMeta(tipo)} removida.` });
    return;
  }

  await limparEstado(userId);
  await sock.sendMessage(userId, { text: '↩️ Remoção cancelada.' });
}

// ─── Quanto falta para a meta ──────────────────────────────────────────────

async function quantoFaltaMeta(sock: any, userId: string, norm: string): Promise<void> {
  const tipo = detectarTipoMeta(norm) || 'DIARIA';
  const meta = await driverService.getGoal(userId, tipo);
  if (!meta) {
    await sock.sendMessage(userId, {
      text: `⚠️ Você não tem uma meta ${labelMeta(tipo)} definida.\n\nPara definir:\n• "meta diária 250"\n• "meta mensal 6000"`,
    });
    return;
  }
  let lucroAtual: number;
  if (tipo === 'DIARIA') {
    lucroAtual = await driverService.getLucroDia(userId);
  } else if (tipo === 'SEMANAL') {
    const resumo = await driverService.getResumoSemana(userId);
    lucroAtual = resumo.lucro;
  } else {
    const resumo = await driverService.getResumoMes(userId);
    lucroAtual = resumo.lucro;
  }
  const faltam = meta.valor - lucroAtual;
  if (faltam <= 0) {
    await sock.sendMessage(userId, {
      text: `🎯 *Meta ${labelMeta(tipo)} atingida!*\n\nVocê lucrou R$ ${formatarValor(lucroAtual)} — meta era R$ ${formatarValor(meta.valor)}. Parabéns! 🏆`,
    });
  } else {
    const pct = Math.round((lucroAtual / meta.valor) * 100);
    await sock.sendMessage(userId, {
      text:
        `🎯 *Meta ${labelMeta(tipo)}: R$ ${formatarValor(meta.valor)}*\n\n` +
        `Lucro atual: R$ ${formatarValor(lucroAtual)}\n` +
        `Faltam: R$ ${formatarValor(faltam)} (${pct}% concluído)`,
    });
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function metaCommand(sock: any, userId: string, texto: string): Promise<void> {
  const norm = normalizar(texto);

  try {
    // Despachar para handler do estado ativo
    const estado = await obterEstado(userId);

    if (estado?.etapa === 'aguardando_acao_meta') {
      return await handleMetaAcao(sock, userId, texto);
    }
    if (estado?.etapa === 'aguardando_novo_valor_meta') {
      const { tipo } = estado.dadosParciais as any;
      return await handleNovoValorMeta(sock, userId, texto, tipo);
    }
    if (estado?.etapa === 'confirmando_remocao_meta') {
      const { tipo } = estado.dadosParciais as any;
      return await handleConfirmarRemocao(sock, userId, texto, tipo);
    }

    // Quanto falta para a meta?
    if (/quanto falta|falta (para|pra)/.test(norm)) {
      return await quantoFaltaMeta(sock, userId, norm);
    }

    // Remover meta via texto ("remover meta diária") → confirmação interativa
    if (/\bremover\s+meta\b/.test(norm)) {
      const tipo = detectarTipoMeta(norm);
      if (!tipo) {
        await sock.sendMessage(userId, {
          text: '⚠️ Informe qual meta remover:\n• "remover meta diária"\n• "remover meta semanal"\n• "remover meta mensal"',
        });
        return;
      }
      const meta = await driverService.getGoal(userId, tipo);
      if (!meta) {
        await sock.sendMessage(userId, { text: `⚠️ Não encontrei uma meta ${labelMeta(tipo)} ativa.` });
        return;
      }
      await definirEstado(userId, 'confirmando_remocao_meta', { tipo });
      await sock.sendInteractiveMessage(userId, {
        type: 'button',
        header: `🗑️ Remover meta ${labelMeta(tipo)}`,
        body: `Confirmar remoção da meta ${labelMeta(tipo)} de R$ ${formatarValor(meta.valor)}?`,
        buttons: [
          { id: '1', title: '✅ Confirmar' },
          { id: '2', title: '❌ Cancelar' },
        ],
      });
      return;
    }

    // Definir meta com tipo e valor na mesma mensagem ("meta diária 300")
    const tipo = detectarTipoMeta(norm);
    const valor = extrairValorMeta(norm);

    if (tipo && valor) {
      await driverService.upsertGoal(userId, tipo, valor);
      await sock.sendMessage(userId, {
        text:
          `✅ Meta ${labelMeta(tipo)} definida: *R$ ${formatarValor(valor)}*\n\n` +
          `A cada lançamento, vou comparar seu lucro com essa meta.\n` +
          `Para ver o progresso: _quanto falta para a meta_`,
      });
      return;
    }

    // Tipo sem valor → pedir valor via botão
    if (tipo && !valor) {
      await definirEstado(userId, 'aguardando_novo_valor_meta', { tipo });
      await sock.sendInteractiveMessage(userId, {
        type: 'button',
        header: `🎯 Meta ${labelMeta(tipo)}`,
        body: `Qual será o valor da sua meta ${labelMeta(tipo)}?\n\nEx: _300_ para R$ 300`,
        buttons: [{ id: 'cancelar_meta', title: '❌ Cancelar' }],
      });
      return;
    }

    // Fallback: mostrar lista interativa de metas
    return await mostrarMetasInterativas(sock, userId);
  } catch (err) {
    logger.error({ err }, '[META] Erro ao processar comando de meta');
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '❌ Erro ao processar sua meta. Tente novamente.' });
  }
}
