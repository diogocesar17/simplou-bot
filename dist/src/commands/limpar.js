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
const sistemaService = __importStar(require("../services/sistemaService"));
async function limparCommand(sock, userId) {
    // Limpar dados antigos reais
    const resultado = await sistemaService.limparDadosAntigos();
    if (resultado.sucesso) {
        let msg = '🧹 *Limpeza de dados antigos concluída!*\n\n';
        if (resultado.lancamentosRemovidos > 0) {
            msg += `📋 Lançamentos removidos: ${resultado.lancamentosRemovidos}\n`;
        }
        if (resultado.logsRemovidos > 0) {
            msg += `📄 Logs removidos: ${resultado.logsRemovidos}\n`;
        }
        if (resultado.arquivosRemovidos > 0) {
            msg += `📁 Arquivos temporários removidos: ${resultado.arquivosRemovidos}\n`;
        }
        if (resultado.lancamentosRemovidos === 0 && resultado.logsRemovidos === 0 && resultado.arquivosRemovidos === 0) {
            msg += 'ℹ️ Nenhum dado antigo foi encontrado para remoção.';
        }
        await sock.sendMessage(userId, { text: msg });
    }
    else {
        await sock.sendMessage(userId, { text: '❌ Erro ao limpar dados antigos. Tente novamente.' });
    }
}
exports.default = limparCommand;
//# sourceMappingURL=limpar.js.map