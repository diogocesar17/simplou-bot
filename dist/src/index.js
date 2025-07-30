"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
global.aguardandoEdicaoCartao = {};
global.aguardandoExclusaoCartao = {};
global.aguardandoPerguntaInteligente = {};
// Imports dos comandos
const ajuda_1 = __importDefault(require("./commands/ajuda"));
const resumo_1 = __importDefault(require("./commands/resumo"));
const resumoDetalhado_1 = __importDefault(require("./commands/resumoDetalhado"));
const historico_1 = __importDefault(require("./commands/historico"));
const fatura_1 = __importDefault(require("./commands/fatura"));
const categoria_1 = __importDefault(require("./commands/categoria"));
const valorAlto_1 = __importDefault(require("./commands/valorAlto"));
const parcelados_1 = __importDefault(require("./commands/parcelados"));
const recorrentes_1 = __importDefault(require("./commands/recorrentes"));
const vencimentos_1 = __importDefault(require("./commands/vencimentos"));
const excluirLancamento_1 = __importDefault(require("./commands/excluirLancamento"));
const editarLancamento_1 = __importDefault(require("./commands/editarLancamento"));
const listarCartoes_1 = __importDefault(require("./commands/listarCartoes"));
const configurarCartao_1 = __importDefault(require("./commands/configurarCartao"));
const editarCartao_1 = __importDefault(require("./commands/editarCartao"));
const excluirCartao_1 = __importDefault(require("./commands/excluirCartao"));
const status_1 = __importDefault(require("./commands/status"));
const limpar_1 = __importDefault(require("./commands/limpar"));
const backup_1 = __importDefault(require("./commands/backup"));
const logs_1 = __importDefault(require("./commands/logs"));
const meuid_1 = __importDefault(require("./commands/meuid"));
const quemsou_1 = __importDefault(require("./commands/quemsou"));
const analisar_1 = __importDefault(require("./commands/analisar"));
const sugestoes_1 = __importDefault(require("./commands/sugestoes"));
const previsao_1 = __importDefault(require("./commands/previsao"));
const ajudaInteligente_1 = __importDefault(require("./commands/ajudaInteligente"));
const lancamento_1 = __importDefault(require("./commands/lancamento"));
const cadastrarUsuario_1 = __importDefault(require("./commands/cadastrarUsuario"));
const listarUsuarios_1 = __importDefault(require("./commands/listarUsuarios"));
const promoverPremium_1 = __importDefault(require("./commands/promoverPremium"));
const removerUsuario_1 = __importDefault(require("./commands/removerUsuario"));
const statusUsuario_1 = __importDefault(require("./commands/statusUsuario"));
const alertas_1 = __importDefault(require("./commands/alertas"));
// Imports dos serviços e configurações
const stateManager_1 = require("./configs/stateManager");
const logger_1 = require("../logger");
// Exemplo de função de roteamento (simples)
async function handleMessage(sock, userId, texto) {
    const textoLower = texto.toLowerCase().trim();
    const estado = await (0, stateManager_1.obterEstado)(userId);
    logger_1.logger.info(`Estado: ${estado?.etapa}`);
    if (estado?.etapa?.startsWith('aguardando_')) {
        // Rotear dinamicamente com base na etapa
        if (estado.etapa.includes('edicao_cartao')) {
            await (0, editarCartao_1.default)(sock, userId, texto);
            return;
        }
        if (estado.etapa.includes('escolha_cartao')) {
            await (0, lancamento_1.default)(sock, userId, texto);
            return;
        }
        if (estado.etapa.includes('edicao_lancamento')) {
            await (0, editarLancamento_1.default)(sock, userId, texto);
            return;
        }
        if (estado.etapa.includes('cartao')) {
            await (0, configurarCartao_1.default)(sock, userId, texto);
            return;
        }
        // ... outros fluxos aqui se necessário
    }
    // Roteamento para o comando de ajuda
    if (["ajuda", "menu", "help"].includes(textoLower)) {
        await (0, ajuda_1.default)(sock, userId);
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
        await (0, resumoDetalhado_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de resumo
    if (textoLower.startsWith('resumo')) {
        await (0, resumo_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de histórico
    if (/^(historico|histórico|ultimos|últimos)(\s|$)/i.test(textoLower)) {
        await (0, historico_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de fatura
    if (textoLower.startsWith('fatura ')) {
        await (0, fatura_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de categoria
    if (/^categoria\s+.+/i.test(textoLower)) {
        await (0, categoria_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de valor alto
    if (/^valor alto/i.test(textoLower)) {
        await (0, valorAlto_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de parcelados
    if (["parcelados", "parcelado"].includes(textoLower)) {
        await (0, parcelados_1.default)(sock, userId);
        return;
    }
    // Roteamento para o comando de recorrentes/fixos
    if (["recorrentes", "recorrente", "fixos", "fixo"].includes(textoLower)) {
        await (0, recorrentes_1.default)(sock, userId);
        return;
    }
    // Roteamento para o comando de vencimentos
    if (/^vencimentos(\s*\d*)?$/i.test(textoLower)) {
        await (0, vencimentos_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de exclusão de lançamento
    if (/^excluir\s+\d+$/i.test(textoLower)) {
        await (0, excluirLancamento_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de edição de lançamento
    if (/^editar\s+\d+$/i.test(textoLower)) {
        await (0, editarLancamento_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de listar cartões
    if (["cartoes", "cartões"].includes(textoLower)) {
        await (0, listarCartoes_1.default)(sock, userId);
        return;
    }
    if (["configurar cartao", "cadastrar cartao", "configurar cartão", "cadastrar cartão"].includes(textoLower)) {
        await (0, configurarCartao_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de editar cartão
    if (["editar cartao", "editar cartão"].includes(textoLower)) {
        await (0, editarCartao_1.default)(sock, userId, texto);
        return;
    }
    // Roteamento para o comando de excluir cartão
    if (["excluir cartao", "excluir cartão"].includes(textoLower)) {
        await (0, excluirCartao_1.default)(sock, userId, texto);
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
        await (0, cadastrarUsuario_1.default)(sock, userId, texto);
        return;
    }
    if (textoLower === 'usuarios' || textoLower === 'usuários') {
        await (0, listarUsuarios_1.default)(sock, userId, texto);
        return;
    }
    if (textoLower.startsWith('premium ')) {
        await (0, promoverPremium_1.default)(sock, userId, texto);
        return;
    }
    if (textoLower.startsWith('remover ')) {
        await (0, removerUsuario_1.default)(sock, userId, texto);
        return;
    }
    if (textoLower.startsWith('status ')) {
        await (0, statusUsuario_1.default)(sock, userId, texto);
        return;
    }
    if (textoLower === 'status') {
        await (0, status_1.default)(sock, userId);
        return;
    }
    if (textoLower === 'limpar') {
        await (0, limpar_1.default)(sock, userId);
        return;
    }
    if (textoLower === 'backup') {
        await (0, backup_1.default)(sock, userId);
        return;
    }
    if (textoLower === 'logs') {
        await (0, logs_1.default)(sock, userId);
        return;
    }
    if (textoLower === 'meuid') {
        await (0, meuid_1.default)(sock, userId);
        return;
    }
    if (textoLower === 'quemsou') {
        await (0, quemsou_1.default)(sock, userId);
        return;
    }
    // Roteamento para o comando de alertas
    if (["alertas", "alerta", "lembretes", "lembrete"].includes(textoLower)) {
        await (0, alertas_1.default)(sock, userId);
        return;
    }
    // Roteamento para comandos inteligentes (Gemini)
    if (["analisar", "analise", "análise", "padroes", "padrões"].includes(textoLower)) {
        await (0, analisar_1.default)(sock, userId);
        return;
    }
    if (["sugestoes", "sugestões", "dicas", "economia", "economizar"].includes(textoLower)) {
        await (0, sugestoes_1.default)(sock, userId);
        return;
    }
    if (["previsao", "previsão", "prever", "futuro"].includes(textoLower)) {
        await (0, previsao_1.default)(sock, userId);
        return;
    }
    if (["ajuda inteligente", "ajuda financeira", "consulta", "pergunta"].includes(textoLower)) {
        await (0, ajudaInteligente_1.default)(sock, userId);
        return;
    }
    // Se não reconheceu nenhum comando, tenta registrar lançamento
    await (0, lancamento_1.default)(sock, userId, texto);
}
//# sourceMappingURL=index.js.map