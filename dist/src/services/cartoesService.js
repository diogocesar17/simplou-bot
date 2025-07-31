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
exports.salvarConfiguracaoCartao = salvarConfiguracaoCartao;
exports.buscarConfiguracaoCartao = buscarConfiguracaoCartao;
exports.listarCartoesConfigurados = listarCartoesConfigurados;
exports.excluirCartaoConfigurado = excluirCartaoConfigurado;
exports.contarLancamentosAssociadosCartao = contarLancamentosAssociadosCartao;
exports.calcularDataContabilizacao = calcularDataContabilizacao;
exports.buscarCartoesVencimentoProximo = buscarCartoesVencimentoProximo;
exports.atualizarCartaoConfigurado = atualizarCartaoConfigurado;
exports.buscarFaturaCartao = buscarFaturaCartao;
// @ts-nocheck
const databaseService = __importStar(require("../../databaseService"));
// TODO: Tipar corretamente. Usar any onde necessário.
// Funções para configurar cartões
async function salvarConfiguracaoCartao(userId, dados) {
    return await databaseService.salvarConfiguracaoCartao(userId, dados);
}
async function buscarConfiguracaoCartao(userId, nomeCartao) {
    return await databaseService.buscarConfiguracaoCartao(userId, nomeCartao);
}
async function listarCartoesConfigurados(userId) {
    return await databaseService.listarCartoesConfigurados(userId);
}
async function excluirCartaoConfigurado(userId, nomeCartao) {
    return await databaseService.excluirCartaoConfigurado(userId, nomeCartao);
}
async function contarLancamentosAssociadosCartao(userId, nomeCartao) {
    return await databaseService.contarLancamentosAssociadosCartao(userId, nomeCartao);
}
// Funções para calcular datas de contabilização
async function calcularDataContabilizacao(dataLancamento, diaVencimento) {
    return await databaseService.calcularDataContabilizacao(dataLancamento, diaVencimento);
}
// Funções para buscar vencimentos
async function buscarCartoesVencimentoProximo(userId, dias = 7) {
    return await databaseService.buscarCartoesVencimentoProximo(userId, dias);
}
async function atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento = null) {
    return await databaseService.atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento);
}
async function buscarFaturaCartao(userId, nomeCartao, mes, ano) {
    return await databaseService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
}
//# sourceMappingURL=cartoesService.js.map