// Controle de fluxo agora é totalmente baseado em Redis (stateManager)

// Imports dos comandos
import ajudaCommand from './commands/ajuda';
import resumoCommand from './commands/resumo';
import resumoDetalhadoCommand from './commands/resumoDetalhado';
import historicoCommand from './commands/historico';
import faturaCommand from './commands/fatura';
import categoriaCommand from './commands/categoria';
import valorAltoCommand from './commands/valorAlto';
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
import meuidCommand from './commands/meuid';
import quemsouCommand from './commands/quemsou';
import analisarCommand from './commands/analisar';
import sugestoesCommand from './commands/sugestoes';
import previsaoCommand from './commands/previsao';
import ajudaInteligenteCommand from './commands/ajudaInteligente';
import lancamentoCommand from './commands/lancamento';
import cadastrarUsuarioCommand from './commands/cadastrarUsuario';
import listarUsuariosCommand from './commands/listarUsuarios';
import promoverPremiumCommand from './commands/promoverPremium';
import removerUsuarioCommand from './commands/removerUsuario';
import statusUsuarioCommand from './commands/statusUsuario';
import alertasCommand from './commands/alertas';
import relatorioCommand from './commands/relatorio';
import lembreteCommand from './commands/lembrete';
import meusLembretesCommand from './commands/meuslembretes';

// Imports dos serviços e configurações
import { definirEstado, obterEstado, limparEstado } from './configs/stateManager';
import { formatarCancelamento } from './utils/formatMessages';
import { logger, fileLogger } from './infrastructure/logger';
import * as geminiService from './services/geminiService';
import { initializeDatabase } from './infrastructure/databaseService';
import * as lancamentosService from './services/lancamentosService';

// Exemplo de função de roteamento (simples)
async function handleMessage(sock: any, userId: string, texto: string): Promise<void> {
  const textoLower = texto.toLowerCase().trim();

  const estado = await obterEstado(userId);

  logger.info(`Estado: ${estado?.etapa}`);
  // Tratar qualquer etapa de fluxo (aguardando_*, confirmando_*, etc.)
  if (estado?.etapa) {
    // Salvaguarda global de cancelamento em estados ativos
    if (textoLower === '0' || textoLower === 'cancelar') {
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
    // Pergunta inteligente (Gemini) via stateManager
    if (estado.etapa === 'pergunta_inteligente') {
      const dados = await lancamentosService.buscarDadosParaAnalise(userId, 3);
      const resposta = await geminiService.responderPerguntaFinanceira(userId, texto, dados);
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
  
    if(estado.etapa.includes('tipo_edicao')) {
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

    // Roteamento para estados de meus lembretes (mais específicos) primeiro
    if (
      estado.etapa.includes('selecao_lembrete') ||
      estado.etapa.includes('acao_lembrete') ||
      estado.etapa.includes('confirmando_exclusao_lembrete')
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
  
  // Roteamento para o comando de ajuda
  if (["ajuda", "menu", "help"].includes(textoLower)) {
    await ajudaCommand(sock, userId);
    return;
  }

  // Roteamento para mensagens de boas-vindas
  if (["oi", "olá", "ola", "hello", "hi", "ei", "opa"].includes(textoLower)) {
    await sock.sendMessage(userId, {
      text: `👋 *Olá! Bem-vindo ao Simplou!*\n\n` +
            `💰 *Seu assistente financeiro pessoal*\n\n` +
            `📊 *Comandos principais:*\n` +
            `• resumo: ver resumo do mês\n` +
            `• gastei 50 no mercado: registrar gasto\n` +
            `• recebi 1000 salário: registrar receita\n` +
            `• histórico: ver últimos lançamentos\n` +
            `• ajuda: menu completo\n\n` +
            `💡 *Dica:* Digite *ajuda* para ver todos os comandos disponíveis!`
    });
    return;
  }

  // Roteamento para o comando de resumo detalhado
  if (textoLower.startsWith('resumo detalhado')) {
    await resumoDetalhadoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de resumo
  if (textoLower.startsWith('resumo')) {
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

  // Roteamento para o comando de categoria
  if (/^categoria\s+.+/i.test(textoLower)) {
    await categoriaCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de valor alto
  if (/^valor alto/i.test(textoLower)) {
    await valorAltoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de parcelados
  if (["parcelados", "parcelado"].includes(textoLower)) {
    await parceladosCommand(sock, userId);
    return;
  }

  // Roteamento para o comando de recorrentes/fixos
  if (["recorrentes", "recorrente", "fixos", "fixo"].includes(textoLower)) {
    await recorrentesCommand(sock, userId);
    return;
  }

  // Roteamento para o comando de vencimentos
  if (/^vencimentos(\s*\d*)?$/i.test(textoLower)) {
    await vencimentosCommand(sock, userId, texto);
    return;
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



  // Fluxo padrão segue sem globais. Pergunta inteligente é tratada via stateManager.

  // Roteamento para comandos administrativos
  if (textoLower.startsWith('cadastrar ')) {
    await cadastrarUsuarioCommand(sock, userId, texto);
    return;
  }
  if (textoLower === 'usuarios' || textoLower === 'usuários') {
    await listarUsuariosCommand(sock, userId, texto);
    return;
  }
  if (textoLower.startsWith('premium ')) {
    await promoverPremiumCommand(sock, userId, texto);
    return;
  }
  if (textoLower.startsWith('remover ')) {
    await removerUsuarioCommand(sock, userId, texto);
    return;
  }
  if (textoLower.startsWith('status ')) {
    await statusUsuarioCommand(sock, userId, texto);
    return;
  }
  if (textoLower === 'status') {
    await statusCommand(sock, userId);
    return;
  }
  if (textoLower === 'limpar') {
    await limparCommand(sock, userId);
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
  if (textoLower === 'logs') {
    await logsCommand(sock, userId);
    return;
  }
  if (textoLower === 'meuid') {
    await meuidCommand(sock, userId);
    return;
  }
  if (textoLower === 'quemsou') {
    await quemsouCommand(sock, userId);
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
    textoLower.startsWith("meus lembretes ")
  ) {
    await meusLembretesCommand(sock, userId, texto);
    return;
  }

  // Roteamento para comandos inteligentes (Gemini)
  if (["analisar", "analise", "análise", "padroes", "padrões"].includes(textoLower)) {
    await analisarCommand(sock, userId);
    return;
  }
  if (["sugestoes", "sugestões", "dicas", "economia", "economizar"].includes(textoLower)) {
    await sugestoesCommand(sock, userId);
    return;
  }
  if (["previsao", "previsão", "prever", "futuro"].includes(textoLower)) {
    await previsaoCommand(sock, userId);
    return;
  }
  if (["ajuda inteligente", "ajuda financeira", "consulta", "pergunta"].includes(textoLower)) {
    await ajudaInteligenteCommand(sock, userId);
    return;
  }

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
