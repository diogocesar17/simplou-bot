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
async function resumoDetalhadoCommand(sock, userId, texto) {
    const textoLower = texto.toLowerCase().trim();
    let mesAno = textoLower.replace("resumo detalhado", "").trim();
    let parsed;
    if (!mesAno || mesAno === "do mes atual" || mesAno === "do mês atual" || mesAno === "mes atual" || mesAno === "mês atual" || mesAno === "atual" || mesAno === "deste mes" || mesAno === "deste mês" || mesAno === "deste mes atual" || mesAno === "deste mês atual") {
        const agora = new Date();
        parsed = { mes: agora.getMonth() + 1, ano: agora.getFullYear() };
    }
    else {
        parsed = (0, dataUtils_1.parseMesAno)(mesAno);
    }
    if (!parsed) {
        await sock.sendMessage(userId, {
            text: '❌ Formato inválido. Use:\n• resumo detalhado (mês atual)\n• resumo detalhado agosto\n• resumo detalhado 03/2024\n\n💡 *Variações aceitas:*\n• resumo detalhado do mes atual\n• resumo detalhado agosto 2023'
        });
        return;
    }
    // Buscar todos os lançamentos do mês
    const todos = await lancamentosService.listarLancamentos(userId, 9999, parsed.mes, parsed.ano);
    if (!todos || todos.length === 0) {
        await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para ${(0, dataUtils_1.getNomeMes)(parsed.mes - 1)}/${parsed.ano}.` });
        return;
    }
    // Separar entradas e saídas
    const entradas = todos.filter(l => l.tipo === 'receita');
    const saidas = todos.filter(l => l.tipo === 'gasto');
    let msg = `📋 *Resumo Detalhado - ${(0, dataUtils_1.getNomeMes)(parsed.mes - 1)}/${parsed.ano}*\n\n`;
    const formatLancamento = (l) => {
        const dataBR = (l.data instanceof Date)
            ? l.data.toLocaleDateString('pt-BR')
            : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
                ? new Date(l.data).toLocaleDateString('pt-BR')
                : l.data);
        let linha = `📅 ${dataBR} | ${l.categoria} | 💳 ${l.pagamento} | R$ ${(0, formatUtils_1.formatarValor)(l.valor)}\n`;
        if (l.descricao)
            linha += `🧾 ${l.descricao}\n`;
        return linha;
    };
    if (entradas.length > 0) {
        msg += `💰 *Entradas:*\n`;
        entradas.forEach(l => msg += formatLancamento(l));
        msg += '\n';
    }
    if (saidas.length > 0) {
        msg += `💸 *Saídas:*\n`;
        saidas.forEach(l => msg += formatLancamento(l));
        msg += '\n';
    }
    // Totais
    const totalEntradas = entradas.reduce((acc, l) => acc + parseFloat(l.valor), 0);
    const totalSaidas = saidas.reduce((acc, l) => acc + parseFloat(l.valor), 0);
    const saldo = totalEntradas - totalSaidas;
    msg += `📊 *Resumo Final:*\n`;
    msg += `💰 Total de Entradas: R$ ${(0, formatUtils_1.formatarValor)(totalEntradas)}\n`;
    msg += `💸 Total de Saídas: R$ ${(0, formatUtils_1.formatarValor)(totalSaidas)}\n`;
    msg += saldo >= 0
        ? `🟢 Saldo: R$ ${(0, formatUtils_1.formatarValor)(saldo)}`
        : `🔴 Saldo Negativo: R$ ${(0, formatUtils_1.formatarValor)(saldo)}`;
    await sock.sendMessage(userId, { text: msg });
    return;
}
exports.default = resumoDetalhadoCommand;
//# sourceMappingURL=resumoDetalhado.js.map