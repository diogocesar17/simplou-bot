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
async function valorAltoCommand(sock, userId, texto) {
    const match = texto.toLowerCase().match(/^valor alto\s*(\d*)$/i);
    const valorMinimo = match && match[1] ? parseInt(match[1]) : 100;
    if (valorMinimo < 1) {
        await sock.sendMessage(userId, { text: '❌ Valor mínimo deve ser maior que zero.' });
        return;
    }
    const gastos = await lancamentosService.buscarGastosValorAlto(userId, valorMinimo, 20);
    if (!gastos || gastos.length === 0) {
        await sock.sendMessage(userId, { text: `💰 Nenhum gasto encontrado acima de R$ ${(0, formatUtils_1.formatarValor)(valorMinimo)}.` });
        return;
    }
    let msgGastos = `💰 *Gastos Acima de R$ ${(0, formatUtils_1.formatarValor)(valorMinimo)}:*\n\n`;
    let totalAlto = 0;
    gastos.forEach((gasto, idx) => {
        const dataBR = gasto.data instanceof Date
            ? gasto.data.toLocaleDateString('pt-BR')
            : new Date(gasto.data).toLocaleDateString('pt-BR');
        msgGastos += `${idx + 1}. ${dataBR} | 💰 R$ ${(0, formatUtils_1.formatarValor)(gasto.valor)} | 📂 ${gasto.categoria}\n`;
        msgGastos += `   📝 ${gasto.descricao} | 💳 ${gasto.pagamento}\n\n`;
        totalAlto += gasto.valor;
    });
    msgGastos += `💰 *Total: R$ ${(0, formatUtils_1.formatarValor)(totalAlto)}*\n`;
    msgGastos += `📊 ${gastos.length} lançamentos encontrados`;
    await sock.sendMessage(userId, { text: msgGastos });
}
exports.default = valorAltoCommand;
//# sourceMappingURL=valorAlto.js.map