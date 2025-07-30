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
async function parceladosCommand(sock, userId) {
    const parcelados = await lancamentosService.buscarParceladosAtivos(userId, 20);
    if (!parcelados || parcelados.length === 0) {
        await sock.sendMessage(userId, { text: '📦 Nenhum parcelamento ativo encontrado.' });
        return;
    }
    let msgParcelados = '📦 *Parcelamentos Ativos:*\n\n';
    parcelados.forEach((parcelamento, idx) => {
        const parcelasPagas = parcelamento.parcelas.filter(p => p.status === 'paga').length;
        const parcelasPendentes = parcelamento.total_parcelas - parcelasPagas;
        msgParcelados += `${idx + 1}. *${parcelamento.descricao}*\n`;
        msgParcelados += `   💰 Total: R$ ${(0, formatUtils_1.formatarValor)(parcelamento.valor_total)}\n`;
        msgParcelados += `   📦 ${parcelamento.total_parcelas}x de R$ ${(0, formatUtils_1.formatarValor)(parcelamento.valor_parcela)}\n`;
        msgParcelados += `   ✅ Pagas: ${parcelasPagas} | ⏳ Pendentes: ${parcelasPendentes}\n`;
        msgParcelados += `   📂 ${parcelamento.categoria} | 💳 ${parcelamento.pagamento}\n`;
        msgParcelados += `   📅 ${parcelamento.primeira_parcela} a ${parcelamento.ultima_parcela}\n\n`;
    });
    msgParcelados += '💡 Para excluir um parcelamento, use "excluir [número]" no histórico.';
    await sock.sendMessage(userId, { text: msgParcelados });
}
exports.default = parceladosCommand;
//# sourceMappingURL=parcelados.js.map