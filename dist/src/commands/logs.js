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
async function logsCommand(sock, userId) {
    try {
        // Gerar logs de auditoria em CSV
        const resultado = await sistemaService.gerarLogAuditoria(userId, 'recentes');
        if (resultado && resultado.sucesso) {
            let msg = '📄 *Logs de Auditoria gerados com sucesso!*\n\n';
            msg += `📁 Arquivo: ${resultado.nomeArquivo}\n`;
            msg += `📊 Total de registros: ${resultado.total}\n`;
            msg += `📏 Tamanho: ${resultado.tamanho} KB\n\n`;
            msg += '📥 *Arquivo salvo em:*\n';
            msg += `\`${resultado.caminhoArquivo}\`\n\n`;
            msg += '💡 *Conteúdo:*\n';
            msg += 'Logs de auditoria com todas as ações realizadas no sistema.';
            await sock.sendMessage(userId, { text: msg });
        }
        else {
            await sock.sendMessage(userId, { text: '📄 Nenhum log de auditoria encontrado.' });
        }
    }
    catch (error) {
        console.error('Erro ao gerar logs:', error);
        await sock.sendMessage(userId, {
            text: '❌ Erro ao gerar logs de auditoria. Tente novamente.'
        });
    }
}
exports.default = logsCommand;
//# sourceMappingURL=logs.js.map