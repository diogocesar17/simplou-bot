"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResumoDoDia = getResumoDoDia;
exports.getResumoDoMesAtual = getResumoDoMesAtual;
exports.getResumoPorMes = getResumoPorMes;
exports.getResumoReal = getResumoReal;
exports.listarLancamentos = listarLancamentos;
exports.getUltimosLancamentos = getUltimosLancamentos;
exports.getLancamentoPorId = getLancamentoPorId;
exports.salvarLancamento = salvarLancamento;
exports.atualizarLancamentoPorId = atualizarLancamentoPorId;
exports.excluirLancamentoPorId = excluirLancamentoPorId;
exports.buscarDadosParaAnalise = buscarDadosParaAnalise;
exports.buscarDadosParaSugestoes = buscarDadosParaSugestoes;
exports.buscarDadosParaPrevisao = buscarDadosParaPrevisao;
exports.buscarFaturaCartao = buscarFaturaCartao;
exports.buscarGastosPorCategoria = buscarGastosPorCategoria;
exports.buscarGastosValorAlto = buscarGastosValorAlto;
exports.buscarParceladosAtivos = buscarParceladosAtivos;
exports.buscarRecorrentesAtivos = buscarRecorrentesAtivos;
exports.excluirParcelamentoPorId = excluirParcelamentoPorId;
exports.excluirRecorrentePorId = excluirRecorrentePorId;
exports.buscarProximosVencimentos = buscarProximosVencimentos;
exports.buscarLancamentosParaExclusao = buscarLancamentosParaExclusao;
// @ts-nocheck
const databaseService = __importStar(require("../../databaseService"));
// TODO: Tipar corretamente. Usar any onde necessário.
// Funções para resumos
async function getResumoDoDia(userId) {
    return await databaseService.getResumoDoDia(userId);
}
async function getResumoDoMesAtual(userId) {
    return await databaseService.getResumoDoMesAtual(userId);
}
async function getResumoPorMes(userId, mes, ano) {
    return await databaseService.getResumoPorMes(userId, mes, ano);
}
async function getResumoReal(userId, mes, ano) {
    return await databaseService.getResumoReal(userId, mes, ano);
}
// Funções para listagem
async function listarLancamentos(userId, limite = 10, mes, ano) {
    return await databaseService.listarLancamentos(userId, limite, mes, ano);
}
async function getUltimosLancamentos(userId, limite = 10) {
    return await databaseService.getUltimosLancamentos(userId, limite);
}
async function getLancamentoPorId(userId, id) {
    return await databaseService.getLancamentoPorId(userId, id);
}
// Funções para salvar/atualizar
async function salvarLancamento(userId, dados) {
    // Converter objeto para array na ordem correta dos campos
    const values = [
        dados.data, // $2
        dados.tipo, // $3
        dados.descricao, // $4
        dados.valor, // $5
        dados.categoria, // $6
        dados.pagamento, // $7
        dados.parcelamento_id || null, // $8
        dados.parcela_atual || null, // $9
        dados.total_parcelas || null, // $10
        dados.recorrente || null, // $11
        dados.recorrente_fim || null, // $12
        dados.recorrente_id || null, // $13
        dados.cartao_nome || null, // $14
        dados.data_lancamento || null, // $15
        dados.data_contabilizacao || null, // $16
        dados.mes_fatura || null, // $17
        dados.ano_fatura || null, // $18
        dados.dia_vencimento || null, // $19
        dados.status_fatura || null, // $20
        dados.data_vencimento || null // $21
    ];
    return await databaseService.appendRowToDatabase(userId, values);
}
async function atualizarLancamentoPorId(userId, id, dados) {
    return await databaseService.atualizarLancamentoPorId(userId, id, dados);
}
async function excluirLancamentoPorId(userId, id) {
    return await databaseService.excluirLancamentoPorId(userId, id);
}
// Funções para análise
async function buscarDadosParaAnalise(userId, meses = 6) {
    return await databaseService.getDatabaseData(userId);
}
async function buscarDadosParaSugestoes(userId) {
    return await databaseService.getDatabaseData(userId);
}
async function buscarDadosParaPrevisao(userId) {
    return await databaseService.getDatabaseData(userId);
}
// Funções para cartões
async function buscarFaturaCartao(userId, nomeCartao, mes, ano) {
    return await databaseService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
}
async function buscarGastosPorCategoria(userId, categoria, limite = 20, mes, ano) {
    return await databaseService.buscarGastosPorCategoria(userId, categoria, limite, mes, ano);
}
async function buscarGastosValorAlto(userId, valorMinimo = 100) {
    return await databaseService.buscarGastosValorAlto(userId, valorMinimo);
}
// Funções para parcelamentos e recorrentes
async function buscarParceladosAtivos(userId) {
    return await databaseService.buscarParceladosAtivos(userId);
}
async function buscarRecorrentesAtivos(userId) {
    return await databaseService.buscarRecorrentesAtivos(userId);
}
async function excluirParcelamentoPorId(userId, id) {
    return await databaseService.excluirParcelamentoPorId(userId, id);
}
async function excluirRecorrentePorId(userId, id) {
    return await databaseService.excluirRecorrentePorId(userId, id);
}
// Funções para vencimentos
async function buscarProximosVencimentos(userId, dias = 7) {
    return await databaseService.buscarProximosVencimentos(userId, dias);
}
// Funções para exclusão em lote
async function buscarLancamentosParaExclusao(userId, filtros) {
    return await databaseService.buscarLancamentosParaExclusao(userId, filtros);
}
//# sourceMappingURL=lancamentosService.js.map