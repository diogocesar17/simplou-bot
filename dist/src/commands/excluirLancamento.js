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
const stateManager_1 = require("../configs/stateManager");
async function excluirLancamentoCommand(sock, userId, texto) {
    const match = texto.toLowerCase().match(/^excluir\s+(\d+)$/i);
    if (!match) {
        await sock.sendMessage(userId, { text: '❌ Use: excluir [número]. Exemplo: excluir 3' });
        return;
    }
    // Verificar se há um histórico exibido no estado
    const estado = await (0, stateManager_1.obterEstado)(userId);
    if (!estado || estado.etapa !== 'historico_exibido') {
        await sock.sendMessage(userId, {
            text: '❌ Execute "histórico" primeiro para ver a lista de lançamentos disponíveis para exclusão.'
        });
        return;
    }
    // Verificar se o estado não expirou (mais de 10 minutos)
    const agora = Date.now();
    const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
    if (agora - estado.dadosParciais.timestamp > tempoExpiracao) {
        await (0, stateManager_1.limparEstado)(userId);
        await sock.sendMessage(userId, {
            text: '❌ A lista expirou. Execute "histórico" novamente para ver os lançamentos.'
        });
        return;
    }
    const idx = parseInt(match[1], 10) - 1;
    const lista = estado.dadosParciais.lista;
    if (!lista || !lista[idx]) {
        await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
        return;
    }
    const lancamento = lista[idx];
    try {
        // Chamar serviço para excluir
        await lancamentosService.excluirLancamentoPorId(userId, lancamento.id);
        // Limpar estado após exclusão bem-sucedida
        await (0, stateManager_1.limparEstado)(userId);
        await sock.sendMessage(userId, {
            text: `✅ *Lançamento excluído com sucesso!*\n\n📝 Descrição: ${lancamento.descricao}\n💰 Valor: R$ ${lancamento.valor}\n📂 Categoria: ${lancamento.categoria}`
        });
    }
    catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        await sock.sendMessage(userId, { text: '❌ Erro ao excluir lançamento. Tente novamente.' });
    }
}
exports.default = excluirLancamentoCommand;
//# sourceMappingURL=excluirLancamento.js.map