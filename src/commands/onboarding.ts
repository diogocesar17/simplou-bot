import * as driverService from '../services/driverService';
import { definirEstado, limparEstado } from '../configs/stateManager';
import { formatarValor } from '../utils/formatUtils';

const TIPO_LABELS: Record<string, string> = {
  MOTORISTA_APP: 'Motorista de app (Uber, 99)',
  DELIVERY: 'Entregador/Delivery (iFood, Rappi, Loggi)',
  AMBOS: 'Motorista e entregador',
};

function detectarTipoTrabalho(texto: string): 'MOTORISTA_APP' | 'DELIVERY' | 'AMBOS' | null {
  const norm = texto.toLowerCase().trim();
  if (norm === '1' || /motorista|app|\buber\b|\b99\b/.test(norm)) return 'MOTORISTA_APP';
  if (norm === '2' || /delivery|entregador|\bifood\b|\brappi\b|\bloggi\b/.test(norm)) return 'DELIVERY';
  if (norm === '3' || /\bambos\b|\bdois\b|\btudo\b/.test(norm)) return 'AMBOS';
  return null;
}

export async function handleOnboardingTipoTrabalho(sock: any, userId: string, texto: string): Promise<void> {
  const tipo = detectarTipoTrabalho(texto);

  if (!tipo) {
    await sock.sendMessage(userId, {
      text:
        '⚠️ Não entendi. Responda com o número ou descreva:\n\n' +
        '1️⃣ Motorista de app (Uber, 99)\n' +
        '2️⃣ Entregador/Delivery (iFood, Rappi, Loggi)\n' +
        '3️⃣ Os dois',
    });
    return;
  }

  await driverService.upsertDriverProfile(userId, { tipo });
  await definirEstado(userId, 'onboarding_meta_diaria', {});
  await sock.sendMessage(userId, {
    text:
      `✅ Perfil salvo: *${TIPO_LABELS[tipo]}*\n\n` +
      '🎯 *Quer definir uma meta diária de ganhos?*\n\n' +
      'A cada corrida ou entrega registrada, vou mostrar quanto você já lucrou e quanto falta para bater a meta.\n\n' +
      '_Ex: responda *300* para R$ 300/dia._\n' +
      '_Ou responda *pular* para configurar depois._',
  });
}

export async function handleOnboardingMetaDiaria(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().trim();

  const pulou = ['pular', 'nao', 'não', 'agora nao', 'agora não', 'depois', 'skip'].includes(norm);
  if (pulou) {
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text:
        '✅ Tudo pronto! Pode definir sua meta depois com _meta diária 300_.\n\n' +
        '🚀 *Comece registrando agora:*\n' +
        '• _ganhei 280 no uber_ → corrida\n' +
        '• _abasteci 150 de gasolina_ → custo\n' +
        '• _lucro hoje_ → ver seu lucro do dia\n\n' +
        'Digite *ajuda* para ver tudo que posso fazer.',
    });
    return;
  }

  const match = norm.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    await sock.sendMessage(userId, {
      text: '⚠️ Informe um valor (ex: _300_) ou responda *pular*.',
    });
    return;
  }

  const valor = parseFloat(match[1].replace(',', '.'));
  if (!valor || valor <= 0) {
    await sock.sendMessage(userId, {
      text: '⚠️ Valor inválido. Informe um número maior que zero (ex: _300_) ou *pular*.',
    });
    return;
  }

  await driverService.upsertGoal(userId, 'DIARIA', valor);
  await limparEstado(userId);
  await sock.sendMessage(userId, {
    text:
      `🎯 Meta diária definida: *R$ ${formatarValor(valor)}*\n\n` +
      '✅ Tudo pronto! A cada lançamento vou mostrar seu lucro acumulado e quanto falta para a meta.\n\n' +
      '🚀 *Vamos começar:*\n' +
      '• _ganhei 280 no uber_ → corrida\n' +
      '• _abasteci 150 de gasolina_ → custo\n' +
      '• _lucro hoje_ → ver seu lucro do dia\n\n' +
      'Digite *ajuda* para ver todos os comandos.',
  });
}
