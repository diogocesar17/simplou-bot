import * as driverService from '../services/driverService';
import * as usuariosService from '../services/usuariosService';
import { setMoeda, MOEDAS } from '../services/preferencesService';
import { definirEstado, limparEstado } from '../configs/stateManager';
import { formatarComMoeda } from '../utils/formatUtils';

const TIPO_LABELS: Record<'DRIVER' | 'OUTROS', string> = {
  DRIVER: 'Motorista/entregador',
  OUTROS: 'Outro trabalho',
};

// Títulos com no máximo 20 caracteres (limite de botão da Meta Cloud API — mesma
// restrição documentada em perguntarNome).
const BOTOES_TIPO_TRABALHO = [
  { id: 'trab_driver', title: '🚗 Motorista/app' },
  { id: 'trab_outros', title: '💼 Outro trabalho' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function prefixoBrasil(userId: string): boolean {
  const numero = userId.split('@')[0];
  return numero.startsWith('55');
}

async function ehDriver(userId: string): Promise<boolean> {
  return (await driverService.getDriverProfile(userId)) !== null;
}

function detectarPerfilTrabalho(texto: string): 'DRIVER' | 'OUTROS' | null {
  const norm = texto.toLowerCase().trim();
  // ids antigos ('1' | '2' | '3') mantidos por compatibilidade — alguém pode ter
  // a tela de onboarding anterior aberta no momento do deploy desta mudança.
  if (norm === 'trab_driver' || norm === '1' || norm === '2' || norm === '3' ||
    /motorista|entregador|\buber\b|\b99\b|\bifood\b|\brappi\b|\bloggi\b|delivery|ambos|dois/.test(norm)) {
    return 'DRIVER';
  }
  if (norm === 'trab_outros' ||
    /\bnenhum\b|nao sou|não sou|autonomo|autônomo|conta propria|conta própria|\boutros?\b/.test(norm)) {
    return 'OUTROS';
  }
  return null;
}

// ─── Step 1: Nome ─────────────────────────────────────────────────────────────

export async function perguntarNome(sock: any, userId: string, nomeProfile?: string): Promise<void> {
  if (nomeProfile) {
    // Trunca para caber no botão (máx 20 chars: "✅ " = 3, sobram 17 para o nome)
    const nomeBtn = nomeProfile.length > 17 ? nomeProfile.slice(0, 16) + '…' : nomeProfile;

    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '👋 Como quer ser chamado?',
      body: `Seu WhatsApp usa o nome *${nomeProfile}*. Pode usar esse ou escolher outro.`,
      buttons: [
        { id: 'nome_confirmar', title: `✅ ${nomeBtn}` },
        { id: 'nome_outro', title: '✏️ Usar outro nome' },
      ],
    });
  } else {
    await sock.sendMessage(userId, { text: '👋 Qual é o seu nome?' });
  }
}

// TTL de 24h para estados de onboarding — o usuário pode interromper e retomar no dia seguinte.
const TTL_ONBOARDING = 86400;

async function salvarNomeEContinuar(sock: any, userId: string, nome: string): Promise<void> {
  await usuariosService.atualizarNomeUsuario(userId, nome);
  await definirEstado(userId, 'onboarding_tipo_trabalho', {}, TTL_ONBOARDING);
  await sock.sendMessage(userId, { text: `Olá, *${nome}*! 😊` });
  await perguntarTipoTrabalho(sock, userId);
}

export async function handleOnboardingNome(sock: any, userId: string, texto: string, nomeProfile?: string): Promise<void> {
  const norm = texto.toLowerCase().trim();

  // Usuário confirmou o nome do perfil via botão
  if (norm === 'nome_confirmar') {
    if (!nomeProfile || nomeProfile.length < 2) {
      await sock.sendMessage(userId, { text: '👋 Qual é o seu nome?' });
      return;
    }
    await salvarNomeEContinuar(sock, userId, nomeProfile);
    return;
  }

  // Usuário quer digitar outro nome
  if (norm === 'nome_outro') {
    await sock.sendMessage(userId, { text: '✏️ Qual nome prefere usar?' });
    return; // permanece no estado onboarding_nome aguardando digitação
  }

  // Usuário digitou o nome
  const nome = texto.trim();
  if (nome.length < 2) {
    await sock.sendMessage(userId, { text: '❌ Nome muito curto. Por favor, informe seu nome:' });
    return;
  }

  await salvarNomeEContinuar(sock, userId, nome);
}

// ─── Step 2: Tipo de trabalho ─────────────────────────────────────────────────

export async function perguntarTipoTrabalho(sock: any, userId: string): Promise<void> {
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '🚗 Qual é o seu trabalho principal?',
    body:
      'Isso me ajuda a reconhecer automaticamente seus ganhos e custos.\n\n' +
      '🚗 *Motorista/app* — motorista ou entregador de aplicativo\n' +
      '💼 *Outro trabalho* — qualquer outra atividade autônoma',
    buttons: BOTOES_TIPO_TRABALHO,
  });
}

export async function handleOnboardingTipoTrabalho(sock: any, userId: string, texto: string): Promise<void> {
  const perfil = detectarPerfilTrabalho(texto);

  if (!perfil) {
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🚗 Qual é o seu trabalho principal?',
      body: 'Toque em uma das opções abaixo para continuar:',
      buttons: BOTOES_TIPO_TRABALHO,
    });
    return;
  }

  if (perfil === 'DRIVER') {
    await driverService.upsertDriverProfile(userId, { tipo: 'AMBOS' });
  } else {
    await driverService.deleteDriverProfile(userId);
  }

  // Usuário fora do Brasil → pergunta a moeda antes da meta
  if (!prefixoBrasil(userId)) {
    await definirEstado(userId, 'onboarding_moeda', {}, TTL_ONBOARDING);
    await perguntarMoeda(sock, userId);
    return;
  }

  // Brasil: grava BRL explicitamente para limpar qualquer preferência anterior
  await setMoeda(userId, 'BRL');

  await definirEstado(userId, 'onboarding_meta_diaria', {}, TTL_ONBOARDING);
  await perguntarMetaDiaria(sock, userId, TIPO_LABELS[perfil], perfil === 'DRIVER');
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
  await definirEstado(userId, 'onboarding_meta_diaria', {}, TTL_ONBOARDING);

  await sock.sendMessage(userId, {
    text: `✅ Moeda definida: *${moeda.nome}* (${moeda.simbolo})`,
  });
  await perguntarMetaDiaria(sock, userId, undefined, await ehDriver(userId));
}

// ─── Step 4: Meta diária ──────────────────────────────────────────────────────

async function perguntarMetaDiaria(sock: any, userId: string, tipoLabel: string | undefined, driver: boolean): Promise<void> {
  if (tipoLabel) {
    await sock.sendMessage(userId, { text: `✅ ${tipoLabel}` });
  }
  const frase = driver ? 'A cada corrida ou entrega registrada' : 'A cada registro';
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '🎯 Quer definir uma meta diária de ganhos?',
    body:
      `${frase}, vou mostrar quanto você já lucrou e quanto falta para bater a meta.\n\n` +
      'Se sim, responda com o valor desejado (ex: _300_ para ganhar 300/dia).',
    buttons: [
      { id: 'pular', title: '⏭️ Definir depois' },
    ],
  });
}

const EXEMPLOS_DRIVER = '• _ganhei 280 no uber_ → corrida\n• _abasteci 150 de gasolina_ → custo';
const EXEMPLOS_GENERICO = '• _recebi 200 de um cliente_ → receita\n• _gastei 50 com material_ → custo';

function blocoExemplos(driver: boolean): string {
  return driver ? EXEMPLOS_DRIVER : EXEMPLOS_GENERICO;
}

export async function handleOnboardingMetaDiaria(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().trim();
  const driver = await ehDriver(userId);

  const pulou = ['pular', 'nao', 'não', 'agora nao', 'agora não', 'depois', 'skip', 'definir depois'].includes(norm);
  if (pulou) {
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text:
        '✅ Tudo pronto! Pode definir sua meta depois com _meta diária 300_.\n\n' +
        '🚀 *Comece registrando agora:*\n' +
        `${blocoExemplos(driver)}\n` +
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
      `${blocoExemplos(driver)}\n` +
      '• _lucro hoje_ → ver seu lucro do dia\n\n' +
      'Digite *ajuda* para ver todos os comandos.',
  });
}
