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
async function recorrentesCommand(sock, userId) {
    const recorrentes = await lancamentosService.buscarRecorrentesAtivos(userId, 20);
    if (!recorrentes || recorrentes.length === 0) {
        await sock.sendMessage(userId, { text: '🔄 Nenhum gasto recorrente/fixo encontrado.' });
        return;
    }
    let msgRecorrentes = '🔄 *Gastos Recorrentes/Fixos:*\n\n';
    recorrentes.forEach((recorrente, idx) => {
        const recorrenciasPagas = recorrente.recorrencias.filter(r => r.status === 'paga').length;
        const recorrenciasPendentes = recorrente.total_recorrencias - recorrenciasPagas;
        msgRecorrentes += `${idx + 1}. *${recorrente.descricao}*\n`;
        msgRecorrentes += `   💰 Valor: R$ ${(0, formatUtils_1.formatarValor)(recorrente.valor)}\n`;
        msgRecorrentes += `   🔄 ${recorrente.total_recorrencias} meses\n`;
        msgRecorrentes += `   ✅ Pagas: ${recorrenciasPagas} | ⏳ Pendentes: ${recorrenciasPendentes}\n`;
        msgRecorrentes += `   📂 ${recorrente.categoria} | 💳 ${recorrente.pagamento}\n`;
        msgRecorrentes += `   📅 ${recorrente.primeira_recorrencia} a ${recorrente.ultima_recorrencia}\n`;
        if (recorrente.recorrente_fim) {
            msgRecorrentes += `   🛑 Fim: ${recorrente.recorrente_fim}\n`;
        }
        msgRecorrentes += '\n';
    });
    msgRecorrentes += '💡 Para excluir um recorrente, use "excluir [número]" no histórico.';
    await sock.sendMessage(userId, { text: msgRecorrentes });
}
exports.default = recorrentesCommand;
//# sourceMappingURL=recorrentes.js.map