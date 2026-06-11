import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { logger } from '../infrastructure/logger';

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

export async function perguntarConsentimento(sock: any, userId: string, nomeProfile?: string): Promise<void> {
  await definirEstado(userId, 'aguardando_consentimento', { nomeProfile: nomeProfile || null });

  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '📋 Antes de começar',
    body:
      'Para usar o Simplou, preciso do seu consentimento para tratar seus dados conforme a *LGPD (Lei 13.709/2018)*.\n\n' +
      '📊 *O que coletamos:*\n' +
      '• Nome e número de WhatsApp\n' +
      '• Lançamentos financeiros (corridas, gastos, custos)\n' +
      '• Perfil de motorista\n\n' +
      '🤖 *Importante:* suas mensagens passam pelo Google Gemini para categorização automática.\n\n' +
      '🔒 *Seus direitos:* exportar e excluir seus dados a qualquer momento.\n\n' +
      '📄 Leia a política completa: simplou.com/privacidade',
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
    });

    logger.info({ userId, vagasDisponiveis }, '[CONSENTIMENTO] Consentimento LGPD aceito');

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
