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
const dataUtils_1 = require("../utils/dataUtils");
const lancamentosService = __importStar(require("../services/lancamentosService"));
async function faturaCommand(sock, userId, texto) {
    const partes = texto.toLowerCase().split(' ');
    if (partes.length < 3) {
        await sock.sendMessage(userId, { text: '❌ Use: fatura [cartão] [mês/ano]. Exemplo: fatura nubank 07/2025' });
        return;
    }
    const nomeCartao = partes[1];
    const mesAno = partes.slice(2).join(' ');
    const parsed = (0, dataUtils_1.parseMesAno)(mesAno);
    if (!parsed) {
        await sock.sendMessage(userId, { text: '❌ Mês/ano inválido. Exemplo: fatura nubank 07/2025' });
        return;
    }
    const { mes, ano } = parsed;
    const fatura = await lancamentosService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
    const nomeMesFatura = (0, dataUtils_1.getNomeMes)(mes - 1);
    if (!fatura || fatura.length === 0) {
        await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para o cartão ${nomeCartao} em ${nomeMesFatura}/${ano}.` });
        return;
    }
    let total = 0;
    let msgFatura = `💳 *Fatura ${nomeCartao} ${nomeMesFatura}/${ano}*\n`;
    fatura.forEach(l => {
        const dataBR = (l.data_lancamento instanceof Date)
            ? l.data_lancamento.toLocaleDateString('pt-BR')
            : (typeof l.data_lancamento === 'string' && l.data_lancamento.match(/\d{4}-\d{2}-\d{2}/)
                ? new Date(l.data_lancamento).toLocaleDateString('pt-BR')
                : l.data_lancamento);
        msgFatura += `• ${dataBR} - ${l.descricao} - R$ ${(0, formatUtils_1.formatarValor)(l.valor)}\n`;
        total += parseFloat(l.valor);
    });
    msgFatura += `\nTotal: R$ ${(0, formatUtils_1.formatarValor)(total)}`;
    await sock.sendMessage(userId, { text: msgFatura });
}
exports.default = faturaCommand;
//# sourceMappingURL=fatura.js.map