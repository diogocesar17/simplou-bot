import { formatarValor } from '../utils/formatUtils';
import * as driverService from '../services/driverService';
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

async function mostrarMetas(sock: any, userId: string): Promise<void> {
  const metas = await driverService.getGoals(userId);
  if (metas.length === 0) {
    await sock.sendMessage(userId, {
      text:
        '🎯 *Suas metas*\n\n' +
        'Você ainda não tem metas definidas.\n\n' +
        'Para definir:\n' +
        '• "minha meta diária é 250"\n' +
        '• "meta mensal de 6000"\n' +
        '• "quero lucrar 300 por dia"',
    });
    return;
  }

  let msg = '🎯 *Suas metas financeiras*\n\n';
  for (const m of metas) {
    msg += `• Meta ${labelMeta(m.tipo_meta)}: R$ ${formatarValor(m.valor)}\n`;
  }
  msg += '\nPara alterar: "meta diária 300"\nPara remover: "remover meta diária"';
  await sock.sendMessage(userId, { text: msg });
}

async function definirMeta(
  sock: any,
  userId: string,
  tipo: 'DIARIA' | 'SEMANAL' | 'MENSAL',
  valor: number,
): Promise<void> {
  await driverService.upsertGoal(userId, tipo, valor);
  const label = labelMeta(tipo);
  await sock.sendMessage(userId, {
    text:
      `✅ Meta ${label} definida: R$ ${formatarValor(valor)}\n\n` +
      `A partir de agora, seu resumo vai comparar o lucro com essa meta.\n` +
      `Para ver: "como foi meu dia" ou "lucro hoje"`,
  });
}

async function removerMeta(
  sock: any,
  userId: string,
  tipo: 'DIARIA' | 'SEMANAL' | 'MENSAL',
): Promise<void> {
  const removeu = await driverService.removeGoal(userId, tipo);
  const label = labelMeta(tipo);
  if (removeu) {
    await sock.sendMessage(userId, { text: `✅ Meta ${label} removida com sucesso.` });
  } else {
    await sock.sendMessage(userId, { text: `⚠️ Não encontrei uma meta ${label} ativa para remover.` });
  }
}

export async function metaCommand(sock: any, userId: string, texto: string): Promise<void> {
  const norm = normalizar(texto);

  try {
    // Mostrar metas
    if (/\b(ver|qual|quais|minhas)\s+metas?\b/.test(norm) || norm === 'meta' || norm === 'metas') {
      return await mostrarMetas(sock, userId);
    }

    // Remover meta
    if (/\bremover\s+meta\b/.test(norm)) {
      const tipo = detectarTipoMeta(norm);
      if (!tipo) {
        await sock.sendMessage(userId, {
          text: '⚠️ Informe qual meta remover:\n• "remover meta diária"\n• "remover meta mensal"',
        });
        return;
      }
      return await removerMeta(sock, userId, tipo);
    }

    // Definir meta (detecta tipo e valor)
    const tipo = detectarTipoMeta(norm);
    const valor = extrairValorMeta(norm);

    if (!tipo) {
      await sock.sendMessage(userId, {
        text:
          '⚠️ Informe o tipo da meta:\n' +
          '• "meta diária 250"\n' +
          '• "meta semanal 1500"\n' +
          '• "meta mensal 6000"',
      });
      return;
    }

    if (!valor) {
      await sock.sendMessage(userId, {
        text: `⚠️ Informe o valor da meta ${labelMeta(tipo)}. Ex.: "meta ${labelMeta(tipo)} 250"`,
      });
      return;
    }

    return await definirMeta(sock, userId, tipo, valor);
  } catch (err) {
    logger.error({ err }, '[META] Erro ao processar comando de meta');
    await sock.sendMessage(userId, { text: '❌ Erro ao processar sua meta. Tente novamente.' });
  }
}
