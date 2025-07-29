// Contextos globais para controle de fluxo
global.aguardandoEdicaoCartao = {};
global.aguardandoExclusaoCartao = {};
global.aguardandoPerguntaInteligente = {};

const ajudaCommand = require('./commands/ajuda');
const resumoCommand = require('./commands/resumo');
const resumoDetalhadoCommand = require('./commands/resumoDetalhado');
const historicoCommand = require('./commands/historico');
const faturaCommand = require('./commands/fatura');
const categoriaCommand = require('./commands/categoria');
const valorAltoCommand = require('./commands/valorAlto');
const parceladosCommand = require('./commands/parcelados');
const recorrentesCommand = require('./commands/recorrentes');
const vencimentosCommand = require('./commands/vencimentos');
const excluirLancamentoCommand = require('./commands/excluirLancamento');
const editarLancamentoCommand = require('./commands/editarLancamento');
const listarCartoesCommand = require('./commands/listarCartoes');
const configurarCartaoCommand = require('./commands/configurarCartao');
const editarCartaoCommand = require('./commands/editarCartao');
const excluirCartaoCommand = require('./commands/excluirCartao');
const statusCommand = require('./commands/status');
const limparCommand = require('./commands/limpar');
const backupCommand = require('./commands/backup');
const logsCommand = require('./commands/logs');
const meuidCommand = require('./commands/meuid');
const quemsouCommand = require('./commands/quemsou');
const analisarCommand = require('./commands/analisar');
const sugestoesCommand = require('./commands/sugestoes');
const previsaoCommand = require('./commands/previsao');
const ajudaInteligenteCommand = require('./commands/ajudaInteligente');
const lancamentoCommand = require('./commands/lancamento');
const cadastrarUsuarioCommand = require('./commands/cadastrarUsuario');
const listarUsuariosCommand = require('./commands/listarUsuarios');
const promoverPremiumCommand = require('./commands/promoverPremium');
const removerUsuarioCommand = require('./commands/removerUsuario');
const statusUsuarioCommand = require('./commands/statusUsuario');
const alertasCommand = require('./commands/alertas');
const { definirEstado, obterEstado, limparEstado } = require('./configs/stateManager');
const { logger, fileLogger } = require('./../logger');


// Exemplo de função de roteamento (simples)
async function handleMessage(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();

  const estado = await obterEstado(userId);

  logger.info(`Estado: ${estado?.etapa}`);
  if (estado?.etapa?.startsWith('aguardando_')) {
    // Rotear dinamicamente com base na etapa
    if (estado.etapa.includes('edicao_cartao')) {
      await editarCartaoCommand(sock, userId, texto);
      return;
    }
  
    if (estado.etapa.includes('cartao')) {
      await configurarCartaoCommand(sock, userId, texto);
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
  if (textoLower.startsWith('fatura ')) {
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

  // Roteamento para o comando de exclusão de lançamento
  if (/^excluir\s+\d+$/i.test(textoLower)) {
    await excluirLancamentoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de edição de lançamento
  if (/^editar\s+\d+$/i.test(textoLower)) {
    await editarLancamentoCommand(sock, userId, texto);
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
  

  // Roteamento para o comando de editar cartão
  if (["editar cartao", "editar cartão"].includes(textoLower)) {
    await editarCartaoCommand(sock, userId, texto);
    return;
  }

  // Roteamento para o comando de excluir cartão
  if (["excluir cartao", "excluir cartão"].includes(textoLower)) {
    await excluirCartaoCommand(sock, userId, texto);
    return;
  }

  // Controle de contexto para pergunta inteligente
  if (global.aguardandoPerguntaInteligente[userId]) {
    delete global.aguardandoPerguntaInteligente[userId];
    const geminiService = require('./services/geminiService');
    const lancamentosService = require('./services/lancamentosService');
    
    // Buscar dados do usuário para contexto
    const dados = await lancamentosService.buscarDadosParaAnalise(userId, 3);
    const resposta = await geminiService.responderPerguntaInteligente(userId, texto, dados);
    await sock.sendMessage(userId, { text: resposta });
    return;
  }

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
  if (["alertas", "alerta", "lembretes", "lembrete"].includes(textoLower)) {
    await alertasCommand(sock, userId);
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

module.exports = { handleMessage }; 