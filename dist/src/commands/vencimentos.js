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
const formatUtils_1 = require("../utils/formatUtils");
const lancamentosService = __importStar(require("../services/lancamentosService"));
async function vencimentosCommand(sock, userId, texto) {
    const match = texto.toLowerCase().match(/^vencimentos\s*(\d+)?$/i);
    const dias = match && match[1] ? parseInt(match[1]) : 30;
    if (dias < 1 || dias > 365) {
        await sock.sendMessage(userId, { text: '❌ Período inválido. Use entre 1 e 365 dias.' });
        return;
    }
    const vencimentos = await lancamentosService.buscarProximosVencimentos(userId, dias);
    let msgVencimentos = `📅 *Próximos Vencimentos (${dias} dias):*\n\n`;
    let temVencimentos = false;
    // Cartões
    if (vencimentos.cartoes && vencimentos.cartoes.length > 0) {
        msgVencimentos += '💳 *Faturas de Cartão:*\n';
        vencimentos.cartoes.forEach((venc) => {
            const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
            msgVencimentos += `${emoji} ${venc.cartao_nome}: R$ ${(0, formatUtils_1.formatarValor)(venc.valor)} (${venc.dias_restantes} dias)\n`;
            msgVencimentos += `   📝 ${venc.descricao} | 📂 ${venc.categoria}\n\n`;
        });
        temVencimentos = true;
    }
    // Boletos
    if (vencimentos.boletos && vencimentos.boletos.length > 0) {
        msgVencimentos += '📄 *Boletos:*\n';
        vencimentos.boletos.forEach((venc) => {
            const emoji = venc.dias_restantes <= 3 ? '🚨' : venc.dias_restantes <= 7 ? '⚠️' : '📅';
            msgVencimentos += `${emoji} R$ ${(0, formatUtils_1.formatarValor)(venc.valor)} (${venc.dias_restantes} dias)\n`;
            msgVencimentos += `   📝 ${venc.descricao} | 📂 ${venc.categoria}\n\n`;
        });
        temVencimentos = true;
    }
    if (!temVencimentos) {
        msgVencimentos = `📅 Nenhum vencimento nos próximos ${dias} dias.`;
    }
    await sock.sendMessage(userId, { text: msgVencimentos });
}
exports.default = vencimentosCommand;
//# sourceMappingURL=vencimentos.js.map