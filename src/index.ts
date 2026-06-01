// Controle de fluxo agora é totalmente baseado em Redis (stateManager)

// Imports dos comandos
import ajudaCommand from './commands/ajuda';
import { ajudaLancamentosCommand, ajudaResumoCommand, ajudaCartaoCommand, ajudaLembreteCommand, ajudaPremiumCommand, ajudaCustosFixosCommand } from './commands/ajudaContextual';
import resumoCommand from './commands/resumo';
import resumoDetalhadoCommand from './commands/resumoDetalhado';
import historicoCommand, { historicoMaisCommand } from './commands/historico';
import faturaCommand from './commands/fatura';
import parceladosCommand from './commands/parcelados';
import recorrentesCommand from './commands/recorrentes';
import vencimentosCommand from './commands/vencimentos';
import excluirLancamentoCommand from './commands/excluirLancamento';
import editarLancamentoCommand from './commands/editarLancamento';
import listarCartoesCommand from './commands/listarCartoes';
import configurarCartaoCommand from './commands/configurarCartao';
import editarCartaoCommand from './commands/editarCartao';
import editarComMenuCommand from './commands/editarComMenu';
import excluirCartaoCommand from './commands/excluirCartao';
import excluirComMenuCommand from './commands/excluirComMenu';
import statusCommand from './commands/status';
import limparCommand from './commands/limpar';
import backupCommand from './commands/backup';
import logsCommand from './commands/logs';
import perfilCommand from './commands/perfil';
import analisarCommand from './commands/analisar';
import sugestoesCommand from './commands/sugestoes';
import previsaoCommand from './commands/previsao';
import ajudaInteligenteCommand from './commands/ajudaInteligente';
import lancamentoCommand from './commands/lancamento';
import listarUsuariosCommand from './commands/listarUsuarios';
import { promoverUsuarioCommand } from './commands/promoverUsuario';
import removerUsuarioCommand from './commands/removerUsuario';
import alertasCommand from './commands/alertas';
import relatorioCommand from './commands/relatorio';
import lembreteCommand from './commands/lembrete';
import meusLembretesCommand from './commands/meuslembretes';
import assinarCommand from './commands/assinar';
import desfazerCommand, { desfazerConfirmarCommand } from './commands/desfazer';
import orcamentoCommand from './commands/orcamento';
import trialCommand from './commands/trial';
import quantoGasteiCommand from './commands/quantoGastei';
import { driverResumoCommand, driverResumoMesEspecificoCommand } from './commands/driverResumo';
import { metaCommand } from './commands/meta';
import { driverPerfilCommand } from './commands/driverPerfil';
import { custoFixoCommand } from './commands/custoFixo';
import iaFallbacksCommand from './commands/iaFallbacks';
import moedaCommand from './commands/moeda';
import { perguntarNome, handleOnboardingNome, handleOnboardingTipoTrabalho, handleOnboardingMoeda, handleOnboardingMetaDiaria } from './commands/onboarding';
import { excluirContaCommand, handleConfirmacaoExclusaoConta } from './commands/excluirConta';
import { isDriverResumoQuery, isMetaQuery, isCustoFixoQuery, isDriverPerfilQuery } from './utils/driverParser';
import * as driverService from './services/driverService';
import { getMoeda } from './services/preferencesService';
import { runWithUserContext } from './configs/userContext';

// Imports dos serviços e configurações
import { parseMesAno } from './utils/dataUtils';
import { definirEstado, obterEstado, limparEstado } from './configs/stateManager';
import { formatarCancelamento } from './utils/formatMessages';
import { formatarValor, formatarComMoeda } from './utils/formatUtils';
import { logger, fileLogger } from './infrastructure/logger';
import * as geminiService from './services/geminiService';
import { initializeDatabase } from './infrastructure/databaseService';
import * as lancamentosService from './services/lancamentosService';
import { routeIntent } from './intents/intentRouter';
import { buscarUsuario, cadastrarUsuario } from './services/usuariosService';
import { verificarRateLimit } from './services/rateLimitService';

// Exemplo de função de roteamento (simples)
async function handleMessage(sock: any, userId: string, texto: string, nomeContato?: string): Promise<void> {
  const { simbolo } = await getMoeda(userId);
  return runWithUserContext({ simboloMoeda: simbolo }, () => _handleMessage(sock, userId, texto, nomeContato));
}

async function _handleMessage(sock: any, userId: string, texto: string, nomeContato?: string): Promise<void> {
  const textoLower = texto.toLowerCase().trim();

  const estado = await obterEstado(userId);

  // Onboarding: cadastrar e dar boas-vindas a novos usuários
  const usuario = await buscarUsuario(userId);
  if (!usuario) {
    await cadastrarUsuario(userId, { nome: nomeContato || 'Usuário' });
    await sock.sendMessage(userId, {
      text:
        '👋 *Bem-vindo ao Simplou Driver!*\n\n' +
        '🚗 Sou seu assistente financeiro no WhatsApp, feito para *motoristas de app e entregadores*.\n\n' +
        'Uber, 99, iFood, Rappi, Loggi — registro tudo por mensagem simples:\n\n' +
        '💰 *Receitas*\n' +
        '• _ganhei 280 no uber_ → registra corrida\n' +
        '• _recebi 90 no ifood_ → registra entrega\n\n' +
        '⛽ *Custos operacionais*\n' +
        '• _abasteci 150 de gasolina_ → registra combustível\n' +
        '• _paguei 12 de pedágio_ → registra pedágio\n\n' +
        'Escreva naturalmente — não precisa decorar comandos. Digite *ajuda* para ver tudo que posso fazer.'
    });
    await definirEstado(userId, 'onboarding_nome', { nomeProfile: nomeContato });
    await perguntarNome(sock, userId, nomeContato);
    return;
  }

  // Rate limiting: bloquear usuários que excederam 40 mensagens/hora
  const permitido = await verificarRateLimit(userId);
  if (!permitido) {
    await sock.sendMessage(userId, {
      text: '⏳ Você enviou muitas mensagens. Aguarde alguns minutos antes de continuar.'
    });
    return;
  }

  logger.info(`Estado: ${estado?.etapa}`);

  // Mensagem padrão do link da landing page — usuário já cadastrado voltando pelo CTA
  const textoSemAcento = textoLower.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isMensagemLanding =
    textoSemAcento.includes('quero usar o simplou') ||
    textoSemAcento.includes('quero usar simplou') ||
    textoSemAcento === 'ola' ||
    textoSemAcento === 'oi' ||
    textoSemAcento === 'ola!' ||
    textoSemAcento === 'oi!';
  if (isMensagemLanding && !estado?.etapa) {
    const nome = nomeContato ? `, ${nomeContato}` : '';
    await sock.sendMessage(userId, {
      text:
        `👋 Olá${nome}! Bem-vindo ao *Simplou Driver*.\n\n` +
        `🚗 Sou seu assistente financeiro no WhatsApp — feito para motoristas de app e entregadores.\n\n` +
        `*Por onde quer começar?*\n\n` +
        `💰 Registrar ganhos: _"fiz 280 no Uber"_, _"recebi 90 no iFood"_\n` +
        `⛽ Registrar custos: _"abasteci 150 de gasolina"_, _"paguei pedágio 12"_\n` +
        `📊 Ver lucro: _"lucro hoje"_, _"resumo da semana"_\n` +
        `🎯 Criar meta: _"meta diária 300"_\n\n` +
        `Digite *ajuda* para ver tudo que posso fazer.`
    });
    return;
  }

  // Paginação do histórico: "mais" tem prioridade sobre qualquer outro estado
  if (estado?.etapa === 'historico_exibido' && textoLower === 'mais') {
    await historicoMaisCommand(sock, userId);
    return;
  }

  // Tratar qualquer etapa de fluxo (aguardando_*, confirmando_*, etc.)
  if (estado?.etapa) {
    // Salvaguarda global de cancelamento em estados ativos
    // Exceção: "0" é válido como dias_antecedencia no wizard de lembrete (G-03)
    const isAntecedenciaStep = estado.etapa === 'aguardando_antecedencia_lembrete';
    const isOnboardingStep = estado.etapa.startsWith('onboarding_');
    if (!isOnboardingStep && ((textoLower === '0' && !isAntecedenciaStep) || textoLower === 'cancelar')) {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: formatarCancelamento('Operação', [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }
    // Wizard de onboarding driver
    if (estado.etapa === 'confirmando_exclusao_conta') {
      await handleConfirmacaoExclusaoConta(sock, userId, texto);
      return;
    }
    if (estado.etapa === 'onboarding_nome') {
      await handleOnboardingNome(sock, userId, texto);
      return;
    }
    if (estado.etapa === 'onboarding_tipo_trabalho') {
      await handleOnboardingTipoTrabalho(sock, userId, textoLower);
      return;
    }
    if (estado.etapa === 'onboarding_moeda') {
      await handleOnboardingMoeda(sock, userId, texto);
      return;
    }
    if (estado.etapa === 'onboarding_meta_diaria') {
      await handleOnboardingMetaDiaria(sock, userId, textoLower);
      return;
    }

    // Pergunta inteligente (Gemini) via stateManager
    if (estado.etapa === 'pergunta_inteligente') {
      const [dados, driverContext] = await Promise.all([
        lancamentosService.buscarDadosParaAnalise(userId, 3),
        driverService.buildDriverContext(userId),
      ]);
      const resposta = await geminiService.responderPerguntaFinanceira(userId, texto, dados, driverContext);
      if (!resposta) {
        await sock.sendMessage(userId, {
          text:
            '❌ Assistente inteligente indisponível no momento.\n\n' +
            'Se você estiver rodando localmente, verifique a variável GEMINI_API_KEY no .env e reinicie o bot.',
        });
        await limparEstado(userId);
        return;
      }
      await sock.sendMessage(userId, { text: resposta });
      await limparEstado(userId);
      return;
    }

    // Rotear dinamicamente com base na etapa
    if (estado.etapa.includes('edicao_cartao')) {
      await editarCartaoCommand(sock, userId, texto);
      return;
    }

    if(estado.etapa.includes('escolha_cartao')) {
      await lancamentoCommand(sock, userId, texto);
      return;
    }

    if (
      estado.etapa === 'aguardando_confirmacao_ia' ||
      estado.etapa === 'aguardando_forma_pagamento' ||
      estado.etapa === 'aguardando_data_vencimento' ||
      estado.etapa === 'aguardando_pos_lancamento'
    ) {
      await lancamentoCommand(sock, userId, texto);
      return;
    }

    if(estado.etapa.includes('edicao_lancamento')) {
      await editarLancamentoCommand(sock, userId, texto);
      return;
    }

    // Edição de parcelado: etapa de escolha do escopo
    if (estado.etapa.includes('escolha_parcelado_edicao')) {
      await editarLancamentoCommand(sock, userId, texto);
      return;
    }

    // Edição de recorrente: etapa de escolha do escopo
    if (estado.etapa.includes('escolha_recorrente_edicao')) {
      await editarLancamentoCommand(sock, userId, texto);
      return;
    }
  
    if(estado.etapa.includes('tipo_edicao') || estado.etapa.includes('selecao_lancamento_edicao')) {
      await editarComMenuCommand(sock, userId, texto);
      return;
    }

    if(estado.etapa.includes('tipo_exclusao')) {
      await excluirComMenuCommand(sock, userId, texto);
      return;
    }

    if(estado.etapa.includes('confirmacao_exclusao_lancamento')) {
      await excluirLancamentoCommand(sock, userId, texto);
      return;
    }

    // Exclusão de parcelado: etapa de escolha do escopo
    if (estado.etapa.includes('escolha_exclusao_parcelado')) {
      await excluirLancamentoCommand(sock, userId, texto);
      return;
    }

    // Exclusão de recorrente: etapa de escolha do escopo
    if (estado.etapa.includes('escolha_exclusao_recorrente')) {
      await excluirLancamentoCommand(sock, userId, texto);
      return;
    }

    if(estado.etapa.includes('exclusao_cartao')) {
      await excluirCartaoCommand(sock, userId, texto);
      return;
    }

    if (estado.etapa.includes('cartao')) {
      await configurarCartaoCommand(sock, userId, texto);
      return;
    }

    // Confirmação do comando limpar
    if (estado.etapa === 'aguardando_confirmacao_limpar') {
      await limparCommand(sock, userId, texto);
      return;
    }

    // Confirmação do comando desfazer
    if (estado.etapa === 'confirmando_desfazer') {
      await desfazerConfirmarCommand(sock, userId, texto);
      return;
    }

    // Roteamento para estados de parcelados
    if (estado.etapa.includes('selecao_parcelado') || estado.etapa.includes('acao_parcelado')) {
      await parceladosCommand(sock, userId, texto);
      return;
    }

    // Roteamento para estados de recorrentes
    if (estado.etapa.includes('selecao_recorrente') || estado.etapa.includes('acao_recorrente')) {
      await recorrentesCommand(sock, userId, texto);
      return;
    }

    // Roteamento para estados de histórico interativo
    if (estado.etapa.includes('selecao_historico') || estado.etapa.includes('acao_historico')) {
      const ehSelecao = /^\d+$/.test(texto.trim()) || ['fechar', 'mais', 'cancelar', '0', '1', '2'].includes(textoLower);
      if (ehSelecao) {
        await historicoCommand(sock, userId, texto);
        return;
      }
      // Input não é uma seleção — limpa o estado e processa como comando normal
      await limparEstado(userId);
    }

    // Roteamento para estados do wizard de metas
    if (
      estado.etapa === 'aguardando_acao_meta' ||
      estado.etapa === 'aguardando_novo_valor_meta' ||
      estado.etapa === 'confirmando_remocao_meta'
    ) {
      await metaCommand(sock, userId, texto);
      return;
    }

    // Roteamento para estados do wizard de custos fixos
    if (
      estado.etapa === 'aguardando_acao_custo_fixo' ||
      estado.etapa === 'confirmando_remocao_custo_fixo' ||
      estado.etapa.includes('custo_fixo')
    ) {
      await custoFixoCommand(sock, userId, texto);
      return;
    }

    // Roteamento para estados de meus lembretes (mais específicos) primeiro
    if (
      estado.etapa.includes('selecao_lembrete') ||
      estado.etapa.includes('acao_lembrete') ||
      estado.etapa.includes('confirmando_exclusao_lembrete') ||
      estado.etapa.includes('edicao_lembrete')
    ) {
      await meusLembretesCommand(sock, userId, texto);
      return;
    }

    // Roteamento para estados de criação/edição de lembrete (genérico)
    if (estado.etapa.includes('lembrete')) {
      await lembreteCommand(sock, userId, texto);
      return;
    }

    // ... outros fluxos aqui se necessário
  }
  
  try {
    const handled = await routeIntent(sock, userId, texto);
    if (handled) return;
  } catch (e: any) {
    logger.warn({ err: e?.message || e }, '[INTENT] erro no roteamento');
  }

  // Roteamento para ajuda contextual (deve vir antes do ajudaCommand genérico)
  if (textoLower === 'ajuda lancamentos' || textoLower === 'ajuda lançamentos') {
    await ajudaLancamentosCommand(sock, userId); return;
  }
  if (textoLower === 'ajuda resumo' || textoLower === 'ajuda resumos') {
    await ajudaResumoCommand(sock, userId); return;
  }
  if (textoLower === 'ajuda cartao' || textoLower === 'ajuda cartão' || textoLower === 'ajuda cartoes' || textoLower === 'ajuda cartões') {
    await ajudaCartaoCommand(sock, userId); return;
  }
  if (textoLower === 'ajuda lembrete' || textoLower === 'ajuda lembretes') {
    await ajudaLembreteCommand(sock, userId); return;
  }
  if (textoLower === 'ajuda premium' || textoLower === 'ajuda planos' || textoLower === 'ajuda plano') {
    await ajudaPremiumCommand(sock, userId); return;
  }
  if (['ajuda custos fixos', 'ajuda custo fixo', 'ajuda custos', 'ajuda fixos', 'ajuda financiamento', 'ajuda recorrentes'].includes(textoLower)) {
    await ajudaCustosFixosCommand(sock, userId); return;
  }

  // Roteamento para o comando de ajuda
  if (["ajuda", "menu", "help"].includes(textoLower)) {
    await ajudaCommand(sock, userId);
    return;
  }

  // Roteamento para mensagens de boas-vindas
  const SAUDACOES = ['oi', 'olá', 'ola', 'hello', 'hi', 'ei', 'opa', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'tudo bom', 'e aí', 'e ai'];
  if (SAUDACOES.includes(textoLower)) {
    const nomeUsuario = usuario.nome && usuario.nome !== 'Usuário' ? `, ${usuario.nome}` : '';
    let corpo = '';
    try {
      const driverProfile = await driverService.getDriverProfile(userId);
      if (driverProfile) {
        const [lucro, metaDiaria] = await Promise.all([
          driverService.getLucroDia(userId),
          driverService.getGoal(userId, 'DIARIA'),
        ]);
        const emojiLucro = lucro >= 0 ? '🟢' : '🔴';
        corpo = `\n${emojiLucro} *Lucro de hoje: ${formatarComMoeda(lucro)}*`;
        if (metaDiaria) {
          const pct = Math.min(100, Math.round((lucro / metaDiaria.valor) * 100));
          corpo += `\n🎯 Meta diária: ${formatarComMoeda(metaDiaria.valor)} (${pct}%)`;
        }
        corpo += '\n\nDigite *lucro hoje* para detalhes ou *ajuda* para todos os comandos.';
      } else {
        const resumo = await lancamentosService.getResumoDoMesAtual(userId);
        if (resumo.totalLancamentos > 0) {
          const emoji = resumo.saldo >= 0 ? '🟢' : '🔴';
          corpo =
            '\n📊 *Este mês até agora:*\n' +
            `• Gastos: ${formatarComMoeda(resumo.totalDespesas)}\n` +
            `• Receitas: ${formatarComMoeda(resumo.totalReceitas)}\n` +
            `• ${emoji} Saldo: ${formatarComMoeda(resumo.saldo)}\n\n` +
            'Digite *resumo* para ver mais detalhes ou *ajuda* para todos os comandos.';
        } else {
          corpo =
            '\n📝 Você ainda não tem lançamentos este mês.\n' +
            '• _ganhei 280 no uber_ → registra corrida\n' +
            '• _abasteci 150 de gasolina_ → registra custo\n' +
            '• _meta diária 300_ → define meta de ganhos\n\n' +
            'Digite *ajuda* para ver tudo que posso fazer.';
        }
      }
    } catch (_) {
      corpo = '\nDigite *resumo* para ver seu mês ou *ajuda* para todos os comandos.';
    }
    await sock.sendMessage(userId, {
      text: `👋 *Olá${nomeUsuario}! Estou aqui.*${corpo}`
    });
    return;
  }

  // Roteamento para o comando de resumo detalhado
  if (textoLower.startsWith('resumo detalhado')) {
    await resumoDetalhadoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de resumo (driver-aware)
  if (textoLower.startsWith('resumo')) {
    const RESUMOS_SIMPLES = ['resumo', 'resumo hoje', 'resumo do dia', 'resumo da semana', 'resumo do mes', 'resumo do mês', 'resumo mensal'];
    if (RESUMOS_SIMPLES.includes(textoLower)) {
      const driverProfile = await driverService.getDriverProfile(userId);
      if (driverProfile) {
        await driverResumoCommand(sock, userId, textoLower);
        return;
      }
    }
    // Resumo de mês específico para motoristas: "resumo 03/2026"
    const periodoTexto = texto.replace(/^resumo\s*/i, '').trim();
    const periodoAnual = periodoTexto.match(/^(?:anual\s*)?(\d{4})$/);
    if (!periodoAnual && periodoTexto) {
      const parsedData = parseMesAno(periodoTexto);
      if (parsedData) {
        const driverProfile = await driverService.getDriverProfile(userId);
        if (driverProfile) {
          await driverResumoMesEspecificoCommand(sock, userId, parsedData.mes, parsedData.ano);
          return;
        }
      }
    }
    await resumoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de histórico
  if (/^(historico|histórico|ultimos|últimos)(\s|$)/i.test(textoLower)) {
    await historicoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de fatura
  if (
    /^(fatura)(\s|$)/i.test(textoLower) ||
    /^(detalhar\s+fatura)(\s|$)/i.test(textoLower) ||
    /^(ver\s+compras)(\s|$)/i.test(textoLower) ||
    /quanto\s+vou\s+pagar\s+no\s+cart(ao|ão)/i.test(textoLower)
  ) {
    await faturaCommand(sock, userId, texto);
    return;
  }


  // Roteamento para o comando de parcelados
  if (["parcelados", "parcelado"].includes(textoLower)) {
    await parceladosCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de recorrentes/fixos
  if (["recorrentes", "recorrente", "fixos", "fixo"].includes(textoLower)) {
    await recorrentesCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de vencimentos
  if (/^vencimentos(\s*\d*)?$/i.test(textoLower)) {
    await vencimentosCommand(sock, userId, texto);
    return;
  }

  // Roteamento para orçamentos (deve vir antes de excluir genérico)
  if (textoLower.startsWith('orcamento') || textoLower.startsWith('orçamento') || textoLower === 'meus orcamentos' || textoLower === 'meus orçamentos') {
    await orcamentoCommand(sock, userId, texto); return;
  }
  if (textoLower.startsWith('excluir orcamento') || textoLower.startsWith('excluir orçamento')) {
    await orcamentoCommand(sock, userId, texto); return;
  }

  // Roteamento para o comando de excluir (menu inteligente)
  if (textoLower.startsWith('excluir')) {
    await excluirComMenuCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de editar (menu inteligente)
  if (textoLower.startsWith('editar')) {
    await editarComMenuCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de listar cartões
  if (["cartoes", "cartões"].includes(textoLower)) {
    await listarCartoesCommand(sock, userId);
    return;
  }

  if (["configurar cartao", "cadastrar cartao", "configurar cartão", "cadastrar cartão"].includes(textoLower)) {
    await configurarCartaoCommand(sock, userId, texto);
    return;
  }

  if (["editar cartao", "editar cartão"].includes(textoLower)) {
    await editarCartaoCommand(sock, userId, texto);
    return;
  }

  if (["excluir cartao", "excluir cartão", "remover cartao", "remover cartão", "deletar cartao", "deletar cartão"].includes(textoLower)) {
    await excluirCartaoCommand(sock, userId, texto);
    return;
  }

  // Fluxo padrão segue sem globais. Pergunta inteligente é tratada via stateManager.

  // Roteamento para comandos administrativos
  if (['excluir minha conta', 'excluir conta', 'apagar minha conta', 'apagar conta', 'deletar conta', 'deletar minha conta'].includes(textoLower)) {
    await excluirContaCommand(sock, userId);
    return;
  }
  if (textoLower === 'usuarios' || textoLower === 'usuários') {
    await listarUsuariosCommand(sock, userId, texto);
    return;
  }
  if (textoLower.startsWith('remover usuario ')) {
    await removerUsuarioCommand(sock, userId, texto);
    return;
  }
  if (textoLower.startsWith('promover ')) {
    await promoverUsuarioCommand(sock, userId, texto);
    return;
  }
  if (textoLower === 'status') {
    await statusCommand(sock, userId);
    return;
  }
  if (textoLower === 'limpar') {
    await limparCommand(sock, userId, texto);
    return;
  }
  if (textoLower.startsWith('relatorio') || textoLower.startsWith('relatório')) {
    await relatorioCommand(sock, userId, texto);
    return;
  }
  if (textoLower === 'backup') {
    await backupCommand(sock, userId);
    return;
  }
  if (textoLower === 'ia fallbacks' || textoLower.startsWith('ia fallbacks ')) {
    await iaFallbacksCommand(sock, userId, texto);
    return;
  }
  if (textoLower === 'logs') {
    await logsCommand(sock, userId);
    return;
  }
  if (["perfil", "minha conta"].includes(textoLower)) {
    await perfilCommand(sock, userId);
    return;
  }

  // Roteamento para o comando de alertas
  if (["alertas", "alerta"].includes(textoLower)) {
    await alertasCommand(sock, userId);
    return;
  }

  // Roteamento para comandos de lembretes
  if (textoLower === "lembrete" || textoLower.startsWith("lembrete ") || textoLower === "criar lembrete") {
    await lembreteCommand(sock, userId, texto);
    return;
  }
  if (
    textoLower === "meuslembretes" ||
    textoLower.startsWith("meuslembretes ") ||
    textoLower === "meus lembretes" ||
    textoLower.startsWith("meus lembretes ") ||
    textoLower === "lembretes" ||
    textoLower.startsWith("lembretes ")
  ) {
    await meusLembretesCommand(sock, userId, texto);
    return;
  }

  // Roteamento para comandos inteligentes (Gemini)
  if (["analisar", "analise", "análise", "padroes", "padrões"].includes(textoLower)) {
    await analisarCommand(sock, userId);
    return;
  }
  if (["sugestoes", "sugestões", "dicas"].includes(textoLower)) {
    await sugestoesCommand(sock, userId);
    return;
  }
  if (["previsao", "previsão", "prever"].includes(textoLower)) {
    await previsaoCommand(sock, userId);
    return;
  }
  if (["ajuda inteligente", "ajuda financeira", "assistente", "perguntar", "pergunta", "pergunte"].includes(textoLower)) {
    await ajudaInteligenteCommand(sock, userId);
    return;
  }
  if (textoLower === 'moeda' || textoLower.startsWith('moeda ')) {
    await moedaCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o fluxo de assinatura premium
  if (["assinar", "premium", "planos", "assine"].includes(textoLower)) {
    await assinarCommand(sock, userId);
    return;
  }

  // Roteamento para trial premium
  if (['trial', 'teste gratis', 'teste grátis', 'experimentar', 'testar premium'].includes(textoLower)) {
    await trialCommand(sock, userId); return;
  }

  // Roteamento para o comando desfazer
  if (['desfazer', 'undo', 'cancelar lançamento', 'cancelar lancamento'].includes(textoLower)) {
    await desfazerCommand(sock, userId); return;
  }

  // Roteamento para consulta "quanto gastei em X?"
  if (
    textoLower.startsWith('quanto gastei') ||
    textoLower.startsWith('quanto eu gastei') ||
    textoLower.startsWith('quanto foi gasto') ||
    textoLower.startsWith('quanto já gastei') ||
    textoLower.startsWith('quanto ja gastei')
  ) {
    await quantoGasteiCommand(sock, userId, texto); return;
  }

  // ─── Rotas driver (novas — não interferem no fluxo existente) ───────────

  // Resumos de lucro driver: "lucro hoje", "como foi meu dia", "quanto sobrou"
  if (isDriverResumoQuery(textoLower)) {
    await driverResumoCommand(sock, userId, textoLower); return;
  }

  // Atalhos explícitos de resumo driver
  if (
    ['lucro hoje', 'lucro do dia', 'como foi meu dia', 'quanto sobrou hoje', 'quanto lucrei hoje'].includes(textoLower) ||
    textoLower.startsWith('lucro da semana') || textoLower.startsWith('lucro do mes') ||
    textoLower.startsWith('resumo motorista') || textoLower === 'lucro'
  ) {
    await driverResumoCommand(sock, userId, textoLower); return;
  }

  // Metas financeiras: "minha meta diária é 250", "meta mensal 6000", "ver metas", "quanto falta para a meta"
  if (
    textoLower === 'meta' || textoLower === 'metas' ||
    textoLower.startsWith('meta ') || textoLower.startsWith('minha meta') ||
    textoLower.startsWith('definir meta') || textoLower.startsWith('remover meta') ||
    textoLower.startsWith('quero ganhar') || textoLower.startsWith('quero lucrar') ||
    textoLower.startsWith('quero fazer') ||
    /quanto falta (para|pra) (a\s+)?(minha\s+)?meta/.test(textoLower) ||
    /falta (para|pra) (a\s+)?(minha\s+)?meta/.test(textoLower) ||
    isMetaQuery(textoLower)
  ) {
    await metaCommand(sock, userId, texto); return;
  }

  // Custos fixos: "meu seguro custa 250 por mês", "custos fixos"
  if (
    textoLower === 'custos fixos' || textoLower === 'custo fixo' || textoLower === 'ver custos fixos' ||
    textoLower.startsWith('cadastrar custo fixo') || isCustoFixoQuery(textoLower)
  ) {
    await custoFixoCommand(sock, userId, texto); return;
  }

  // Perfil driver: "sou motorista de app", "trabalho com delivery"
  if (
    textoLower === 'perfil driver' || textoLower === 'ver perfil driver' ||
    isDriverPerfilQuery(textoLower)
  ) {
    await driverPerfilCommand(sock, userId, texto); return;
  }

  // ─────────────────────────────────────────────────────────────────────────

  // Se não reconheceu nenhum comando, tenta registrar lançamento
  await lancamentoCommand(sock, userId, texto);
}

// Inicialização do app (exposta para quem importa)
async function startBotInit(): Promise<void> {
  try {
    // Banco (garante tabelas)
    await initializeDatabase();
  } catch (e: any) {
    console.error('[INIT] Erro ao inicializar banco:', e?.message || e);
  }
  try {
    // Gemini
    geminiService.initializeGemini();
  } catch (e: any) {
    console.error('[INIT] Erro ao inicializar Gemini:', e?.message || e);
  }
}

export { handleMessage, startBotInit };
