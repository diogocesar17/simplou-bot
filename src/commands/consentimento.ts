import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { logger } from '../infrastructure/logger';

export const VERSAO_POLITICA_ATUAL = '1.1'; // atualizar aqui sempre que simplou.com/privacidade mudar

const MENSAGEM_BOAS_VINDAS =
  '✅ Consentimento registrado!\n\n' +
  '👋 *Bem-vindo ao Simplou Driver!*\n\n' +
  '🚗 Sou seu assistente financeiro no WhatsApp, feito para *motoristas de app e entregadores*.\n\n' +
  'Uber, 99, iFood, Rappi, Loggi — registro tudo por mensagem simples:\n\n' +
  '💰 *Receitas*\n' +
  '• _ganhei 280 no uber_ → registra corrida\n' +
  '• _recebi 90 no ifood_ → registra entrega\n\n' +
  '⛽ *Custos operacionais*\n' +
  '• _abasteci 150 de gasolina_ → registra combustível\n' +
  '• _paguei 12 de pedágio_ → registra pedágio\n\n' +
  'Escreva naturalmente — não precisa decorar comandos. Digite *ajuda* para ver tudo que posso fazer.';

function corpoConsentimento(): string {
  return (
    'Para usar o Simplou, preciso do seu consentimento para tratar seus dados conforme a *LGPD (Lei 13.709/2018)*.\n\n' +
    '📊 *O que coletamos:*\n' +
    '• Nome e número de WhatsApp\n' +
    '• Lançamentos financeiros (corridas, gastos, custos)\n' +
    '• Perfil de motorista\n\n' +
    '🤖 *Inteligência artificial:* determinadas funcionalidades utilizam provedores de IA para processar suas solicitações.\n\n' +
    '🔒 *Seus direitos:* exportar e excluir seus dados a qualquer momento.\n\n' +
    `📄 Política v${VERSAO_POLITICA_ATUAL}: simplou.com/privacidade`
  );
}

// ─── Primeiro consentimento (novo usuário) ────────────────────────────────────

export async function perguntarConsentimento(sock: any, userId: string, nomeProfile?: string): Promise<void> {
  await definirEstado(userId, 'aguardando_consentimento', { nomeProfile: nomeProfile || null });

  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '📋 Antes de começar',
    body: corpoConsentimento(),
    buttons: [
      { id: 'aceitar_lgpd', title: '✅ Aceito' },
      { id: 'recusar_lgpd', title: '❌ Não aceito' },
    ],
  });
}

export async function handleConsentimento(
  sock: any,
  userId: string,
  texto: string,
  deps: {
    cadastrarUsuario: (userId: string, dados: any) => Promise<any>;
    contarUsuariosAtivos: () => Promise<number>;
    perguntarNome: (sock: any, userId: string, nomeProfile?: string) => Promise<void>;
    limiteBeta: number;
  },
): Promise<void> {
  const norm = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);
  const nomeProfile: string | null = (estado?.dadosParciais?.nomeProfile as string) ?? null;

  const aceitou = norm === 'aceitar_lgpd' || norm === 'aceitar' || norm === 'aceito';
  const recusou = norm === 'recusar_lgpd' || norm === 'recusar' || norm === 'não aceito' || norm === 'nao aceito';

  if (recusou) {
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text:
        'Tudo bem! Sem o consentimento não é possível usar o Simplou, pois precisamos tratar seus dados para o serviço funcionar.\n\n' +
        'Se mudar de ideia, é só nos chamar de novo. 😊',
    });
    logger.info({ userId }, '[CONSENTIMENTO] Usuário recusou consentimento LGPD');
    return;
  }

  if (aceitou) {
    const totalAtivos = await deps.contarUsuariosAtivos();
    const vagasDisponiveis = totalAtivos < deps.limiteBeta;

    await deps.cadastrarUsuario(userId, {
      nome: nomeProfile || 'Usuário',
      status: vagasDisponiveis ? 'ativo' : 'aguardando',
      consentimento_lgpd: true,
      data_consentimento: new Date(),
      versao_politica: VERSAO_POLITICA_ATUAL,
    });

    logger.info({ userId, vagasDisponiveis, versao: VERSAO_POLITICA_ATUAL }, '[CONSENTIMENTO] Consentimento LGPD aceito');

    if (!vagasDisponiveis) {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text:
          '✅ Consentimento registrado! Obrigado.\n\n' +
          '⏳ Estamos em *fase beta* com vagas limitadas. Sua solicitação foi registrada e você será notificado assim que uma vaga for liberada.\n\n' +
          'Qualquer dúvida: contato@simplou.com',
      });
      return;
    }

    await sock.sendMessage(userId, { text: MENSAGEM_BOAS_VINDAS });
    await definirEstado(userId, 'onboarding_nome', { nomeProfile });
    await deps.perguntarNome(sock, userId, nomeProfile || undefined);
    return;
  }

  // Resposta não reconhecida — repete a pergunta
  await perguntarConsentimento(sock, userId, nomeProfile || undefined);
}

// ─── Re-consentimento (usuário inativo voltando) ──────────────────────────────

export async function perguntarReConsentimento(sock: any, userId: string): Promise<void> {
  await definirEstado(userId, 'aguardando_reconsentimento', {});

  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '📋 Sua conta está desativada',
    body:
      'Você revogou o consentimento anteriormente. Para voltar a usar o Simplou, precisa aceitar novamente a política de privacidade.\n\n' +
      corpoConsentimento(),
    buttons: [
      { id: 'aceitar_lgpd', title: '✅ Aceito novamente' },
      { id: 'recusar_lgpd', title: '❌ Não, obrigado' },
    ],
  });
}

export async function handleReConsentimento(
  sock: any,
  userId: string,
  texto: string,
  atualizarConsentimento: (userId: string, dados: any) => Promise<void>,
): Promise<void> {
  const norm = texto.toLowerCase().trim();

  const aceitou = norm === 'aceitar_lgpd' || norm === 'aceitar' || norm === 'aceito';
  const recusou = norm === 'recusar_lgpd' || norm === 'recusar' || norm === 'não aceito' || norm === 'nao aceito';

  if (aceitou) {
    await atualizarConsentimento(userId, {
      consentimento_lgpd: true,
      status: 'ativo',
      versao_politica: VERSAO_POLITICA_ATUAL,
      data_consentimento: new Date(),
    });
    await limparEstado(userId);
    logger.info({ userId, versao: VERSAO_POLITICA_ATUAL }, '[CONSENTIMENTO] Re-consentimento aceito');
    await sock.sendMessage(userId, {
      text:
        '✅ Consentimento registrado! Sua conta foi reativada.\n\n' +
        'Pode continuar usando o Simplou normalmente. Digite *ajuda* para ver os comandos.',
    });
    return;
  }

  if (recusou) {
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text: 'Tudo bem! Sua conta permanece desativada. Se mudar de ideia, é só nos chamar. 😊',
    });
    return;
  }

  await perguntarReConsentimento(sock, userId);
}

// ─── Revogação de consentimento ───────────────────────────────────────────────

export async function revogarConsentimentoCommand(sock: any, userId: string): Promise<void> {
  await definirEstado(userId, 'confirmando_revogacao_consentimento', {});

  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '⚠️ Revogar consentimento',
    body:
      'Ao revogar, sua conta será *desativada* e o Simplou deixará de processar seus dados.\n\n' +
      '📌 *Seus dados não são apagados imediatamente* — ficam armazenados por 30 dias caso queira reativar. Após esse prazo, são removidos permanentemente.\n\n' +
      'Se preferir apagar tudo agora, use o comando *excluir minha conta*.\n\n' +
      'Confirma a revogação?',
    buttons: [
      { id: 'confirmar_revogacao', title: '✅ Sim, revogar' },
      { id: 'cancelar_revogacao', title: '❌ Cancelar' },
    ],
  });
}

export async function handleConfirmacaoRevogacao(
  sock: any,
  userId: string,
  texto: string,
  atualizarConsentimento: (userId: string, dados: any) => Promise<void>,
): Promise<void> {
  const norm = texto.toLowerCase().trim();

  if (norm === 'cancelar_revogacao' || norm === 'cancelar') {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '↩️ Revogação cancelada. Sua conta continua ativa.' });
    return;
  }

  if (norm === 'confirmar_revogacao' || norm === 'confirmar' || norm === 'sim') {
    await atualizarConsentimento(userId, {
      consentimento_lgpd: false,
      status: 'inativo',
      versao_politica: null,
      data_consentimento: null,
    });
    await limparEstado(userId);
    logger.info({ userId }, '[CONSENTIMENTO] Consentimento revogado');
    await sock.sendMessage(userId, {
      text:
        '✅ Consentimento revogado. Sua conta foi desativada.\n\n' +
        'Seus dados ficam armazenados por 30 dias. Se quiser reativar, é só nos chamar.\n\n' +
        'Para apagar tudo imediatamente, envie *excluir minha conta*.',
    });
    return;
  }

  await revogarConsentimentoCommand(sock, userId);
}
