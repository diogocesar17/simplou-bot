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
async function backupCommand(sock, userId) {
    try {
        const resultado = await sistemaService.gerarBackupCSV(userId);
        if (resultado && resultado.sucesso) {
            let msg = '💾 *Backup gerado com sucesso!*\n\n';
            msg += `📁 Arquivo: ${resultado.nomeArquivo}\n`;
            msg += `📊 Lançamentos: ${resultado.totalLancamentos}\n`;
            msg += `📅 Período: ${resultado.periodo}\n`;
            msg += `📏 Tamanho: ${resultado.tamanho} KB\n\n`;
            msg += '📥 *Arquivo salvo em:*\n';
            msg += `\`${resultado.caminhoArquivo}\`\n\n`;
            msg += '💡 *Para baixar:*\n';
            msg += 'O arquivo foi salvo no servidor. Você pode acessá-lo via FTP ou solicitar ao administrador.';
            await sock.sendMessage(userId, { text: msg });
        }
        else {
            const erroMsg = resultado?.erro || 'Erro desconhecido';
            await sock.sendMessage(userId, {
                text: `❌ Erro ao gerar backup: ${erroMsg}\n\nTente novamente mais tarde.`
            });
        }
    }
    catch (error) {
        console.error('Erro ao gerar backup:', error);
        await sock.sendMessage(userId, {
            text: '❌ Erro interno ao gerar backup. Tente novamente.'
        });
    }
}
exports.default = backupCommand;
//# sourceMappingURL=backup.js.map