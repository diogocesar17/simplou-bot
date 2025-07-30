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
// @ts-nocheck
const lancamentosService = __importStar(require("../services/lancamentosService"));
async function excluirLancamentoCommand(sock, userId, texto) {
    const match = texto.toLowerCase().match(/^excluir\s+(\d+)$/i);
    if (!match) {
        await sock.sendMessage(userId, { text: '❌ Use: excluir [número]. Exemplo: excluir 3' });
        return;
    }
    const idx = parseInt(match[1], 10) - 1;
    // Buscar lista de lançamentos do usuário (mock: buscar últimos 10)
    const lista = await lancamentosService.listarLancamentos(userId, 10);
    if (!lista || !lista[idx]) {
        await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
        return;
    }
    const lancamento = lista[idx];
    // Chamar serviço para excluir
    const ok = await lancamentosService.excluirLancamentoPorId(userId, lancamento.id);
    if (ok) {
        await sock.sendMessage(userId, { text: '✅ Lançamento excluído com sucesso!' });
    }
    else {
        await sock.sendMessage(userId, { text: '❌ Erro ao excluir lançamento.' });
    }
}
exports.default = excluirLancamentoCommand;
//# sourceMappingURL=excluirLancamento.js.map