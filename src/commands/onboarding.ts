import * as driverService from '../services/driverService';
import { definirEstado, limparEstado } from '../configs/stateManager';
import { formatarValor } from '../utils/formatUtils';

const TIPO_LABELS: Record<string, string> = {
  MOTORISTA_APP: 'Motorista de app (Uber, 99)',
  DELIVERY: 'Entregador/Delivery (iFood, Rappi, Loggi)',
  AMBOS: 'Motorista e entregador',
};

const BOTOES_TIPO_TRABALHO = [
  { id: '1', title: '🚗 Motorista App' },
  { id: '2', title: '🛵 Entregador' },
  { id: '3', title: '⚡ Os dois' },
];

export async function perguntarTipoTrabalho(sock: any, userId: string): Promise<void> {
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '🚗 Qual é o seu trabalho principal?',
    body: 'Isso me ajuda a reconhecer automaticamente suas corridas, entregas e custos operacionais.',
    buttons: BOTOES_TIPO_TRABALHO,
  });
}

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
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🚗 Qual é o seu trabalho principal?',
      body: 'Toque em uma das opções abaixo para continuar:',
      buttons: BOTOES_TIPO_TRABALHO,
    });
    return;
  }

  await driverService.upsertDriverProfile(userId, { tipo });
  await definirEstado(userId, 'onboarding_meta_diaria', {});

  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: `✅ ${TIPO_LABELS[tipo]}`,
    body:
      '🎯 *Quer definir uma meta diária de ganhos?*\n\n' +
      'A cada corrida ou entrega registrada, vou mostrar quanto você já lucrou e quanto falta para bater a meta.\n\n' +
      'Se sim, responda com o valor desejado (ex: _300_ para R$ 300/dia).',
    buttons: [
      { id: 'pular', title: '⏭️ Definir depois' },
    ],
  });
}

export async function handleOnboardingMetaDiaria(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().trim();

  const pulou = ['pular', 'nao', 'não', 'agora nao', 'agora não', 'depois', 'skip', 'definir depois'].includes(norm);
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
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🎯 Meta diária de ganhos',
      body: 'Informe o valor da meta (ex: _300_ para R$ 300/dia) ou toque em "Definir depois":',
      buttons: [
        { id: 'pular', title: '⏭️ Definir depois' },
      ],
    });
    return;
  }

  const valor = parseFloat(match[1].replace(',', '.'));
  if (!valor || valor <= 0) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🎯 Meta diária de ganhos',
      body: 'Valor inválido. Informe um número maior que zero (ex: _300_) ou toque em "Definir depois":',
      buttons: [
        { id: 'pular', title: '⏭️ Definir depois' },
      ],
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
