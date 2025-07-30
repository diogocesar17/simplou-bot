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
async function categoriaCommand(sock, userId, texto) {
    const match = texto.toLowerCase().match(/^categoria\s+(.+)$/i);
    if (!match) {
        await sock.sendMessage(userId, { text: '❌ Use: categoria [nome]. Exemplo: categoria lazer' });
        return;
    }
    const categoria = match[1].trim();
    const gastos = await lancamentosService.buscarGastosPorCategoria(userId, categoria, 20);
    if (!gastos || gastos.length === 0) {
        await sock.sendMessage(userId, { text: `📂 Nenhum gasto encontrado na categoria "${categoria}".` });
        return;
    }
    let msgGastos = `📂 *Gastos - ${categoria.toUpperCase()}:*\n\n`;
    let totalCategoria = 0;
    gastos.forEach((gasto, idx) => {
        const dataBR = gasto.data instanceof Date
            ? gasto.data.toLocaleDateString('pt-BR')
            : new Date(gasto.data).toLocaleDateString('pt-BR');
        msgGastos += `${idx + 1}. ${dataBR} | 💰 R$ ${(0, formatUtils_1.formatarValor)(gasto.valor)} | 💳 ${gasto.pagamento}\n`;
        msgGastos += `   📝 ${gasto.descricao}\n\n`;
        totalCategoria += gasto.valor;
    });
    msgGastos += `💰 *Total da categoria: R$ ${(0, formatUtils_1.formatarValor)(totalCategoria)}*\n`;
    msgGastos += `📊 ${gastos.length} lançamentos encontrados`;
    await sock.sendMessage(userId, { text: msgGastos });
}
exports.default = categoriaCommand;
//# sourceMappingURL=categoria.js.map