import * as driverService from '../services/driverService';
import * as usuariosService from '../services/usuariosService';
import { setMoeda, MOEDAS } from '../services/preferencesService';
import { definirEstado, limparEstado } from '../configs/stateManager';
import { formatarComMoeda } from '../utils/formatUtils';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function prefixoBrasil(userId: string): boolean {
  const numero = userId.split('@')[0];
  return numero.startsWith('55');
}

function detectarTipoTrabalho(texto: string): 'MOTORISTA_APP' | 'DELIVERY' | 'AMBOS' | null {
  const norm = texto.toLowerCase().trim();
  if (norm === '1' || /motorista|app|\buber\b|\b99\b/.test(norm)) return 'MOTORISTA_APP';
  if (norm === '2' || /delivery|entregador|\bifood\b|\brappi\b|\bloggi\b/.test(norm)) return 'DELIVERY';
  if (norm === '3' || /\bambos\b|\bdois\b|\btudo\b/.test(norm)) return 'AMBOS';
  return null;
}

// ─── Step 1: Nome ─────────────────────────────────────────────────────────────

export async function perguntarNome(sock: any, userId: string, nomeProfile?: string): Promise<void> {
  const sugestao = nomeProfile
    ? `\n\nSeu WhatsApp mostra o nome *${nomeProfile}*. Pode confirmar digitando o mesmo ou digitar outro nome.`
    : '';

  await sock.sendMessage(userId, {
    text: `👋 Antes de começar, qual é o seu nome?${sugestao}`,
  });
}

export async function handleOnboardingNome(sock: any, userId: string, texto: string): Promise<void> {
  const nome = texto.trim();

  if (nome.length < 2) {
    await sock.sendMessage(userId, { text: '❌ Nome muito curto. Por favor, informe seu nome:' });
    return;
  }

  await usuariosService.atualizarNomeUsuario(userId, nome);
  await definirEstado(userId, 'onboarding_tipo_trabalho', {});

  await sock.sendMessage(userId, {
    text: `Olá, *${nome}*! 😊`,
  });
  await perguntarTipoTrabalho(sock, userId);
}

// ─── Step 2: Tipo de trabalho ─────────────────────────────────────────────────

export async function perguntarTipoTrabalho(sock: any, userId: string): Promise<void> {
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '🚗 Qual é o seu trabalho principal?',
    body: 'Isso me ajuda a reconhecer automaticamente suas corridas, entregas e custos operacionais.',
    buttons: BOTOES_TIPO_TRABALHO,
  });
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

  // Usuário fora do Brasil → pergunta a moeda antes da meta
  if (!prefixoBrasil(userId)) {
    await definirEstado(userId, 'onboarding_moeda', {});
    await perguntarMoeda(sock, userId);
    return;
  }

  await definirEstado(userId, 'onboarding_meta_diaria', {});
  await perguntarMetaDiaria(sock, userId, TIPO_LABELS[tipo]);
}

// ─── Step 3 (opcional): Moeda ─────────────────────────────────────────────────

async function perguntarMoeda(sock: any, userId: string): Promise<void> {
  await sock.sendInteractiveMessage(userId, {
    type: 'list',
    header: '💱 Qual é a sua moeda?',
    body: 'Selecione a moeda que você usa no dia a dia. Todos os valores serão exibidos nela.',
    buttonLabel: 'Ver opções',
    sections: [{
      rows: [
        { id: 'BRL', title: '🇧🇷 Real brasileiro', description: 'R$' },
        { id: 'EUR', title: '🇪🇺 Euro', description: '€' },
        { id: 'USD', title: '🇺🇸 Dólar americano', description: 'US$' },
        { id: 'GBP', title: '🇬🇧 Libra esterlina', description: '£' },
      ],
    }],
  });
}

export async function handleOnboardingMoeda(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.trim().toUpperCase();

  // Aceita tanto o ID do botão (BRL, EUR...) quanto texto livre
  const aliases: Record<string, string> = {
    REAL: 'BRL', REAIS: 'BRL', BRL: 'BRL', BRASIL: 'BRL',
    EURO: 'EUR', EUROS: 'EUR', EUR: 'EUR',
    DOLAR: 'USD', 'DÓLAR': 'USD', USD: 'USD',
    LIBRA: 'GBP', LIBRAS: 'GBP', GBP: 'GBP',
  };

  const codigo = aliases[norm] ?? norm;
  const moeda = MOEDAS[codigo];

  if (!moeda) {
    await perguntarMoeda(sock, userId);
    return;
  }

  await setMoeda(userId, moeda.codigo);
  await definirEstado(userId, 'onboarding_meta_diaria', {});

  await sock.sendMessage(userId, {
    text: `✅ Moeda definida: *${moeda.nome}* (${moeda.simbolo})`,
  });
  await perguntarMetaDiaria(sock, userId);
}

// ─── Step 4: Meta diária ──────────────────────────────────────────────────────

async function perguntarMetaDiaria(sock: any, userId: string, tipoLabel?: string): Promise<void> {
  if (tipoLabel) {
    await sock.sendMessage(userId, { text: `✅ ${tipoLabel}` });
  }
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '🎯 Quer definir uma meta diária de ganhos?',
    body:
      'A cada corrida ou entrega registrada, vou mostrar quanto você já lucrou e quanto falta para bater a meta.\n\n' +
      'Se sim, responda com o valor desejado (ex: _300_ para ganhar 300/dia).',
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
    await sock.sendMessage(userId, {
      text: '📋 Ao usar o Simplou você concorda com nossa Política de Privacidade e Termos de Uso: simplou.com/privacidade',
    });
    return;
  }

  const match = norm.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🎯 Meta diária de ganhos',
      body: 'Informe o valor da meta (ex: _300_ para ganhar 300/dia) ou toque em "Definir depois":',
      buttons: [{ id: 'pular', title: '⏭️ Definir depois' }],
    });
    return;
  }

  const valor = parseFloat(match[1].replace(',', '.'));
  if (!valor || valor <= 0) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🎯 Meta diária de ganhos',
      body: 'Valor inválido. Informe um número maior que zero (ex: _300_) ou toque em "Definir depois":',
      buttons: [{ id: 'pular', title: '⏭️ Definir depois' }],
    });
    return;
  }

  await driverService.upsertGoal(userId, 'DIARIA', valor);
  await limparEstado(userId);
  await sock.sendMessage(userId, {
    text:
      `🎯 Meta diária definida: *${formatarComMoeda(valor)}*\n\n` +
      '✅ Tudo pronto! A cada lançamento vou mostrar seu lucro acumulado e quanto falta para a meta.\n\n' +
      '🚀 *Vamos começar:*\n' +
      '• _ganhei 280 no uber_ → corrida\n' +
      '• _abasteci 150 de gasolina_ → custo\n' +
      '• _lucro hoje_ → ver seu lucro do dia\n\n' +
      'Digite *ajuda* para ver todos os comandos.',
  });
  await sock.sendMessage(userId, {
    text: '📋 Ao usar o Simplou você concorda com nossa Política de Privacidade e Termos de Uso: simplou.com/privacidade',
  });
}
