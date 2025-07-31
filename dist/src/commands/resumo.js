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
async function resumoCommand(sock, userId, texto) {
    let mesAno = texto.toLowerCase().replace('resumo', '').trim();
    let resumo;
    // Resumo do dia
    if (["hoje", "dia", "diario", "diário", "do dia", "do dia atual", "do dia de hoje", "de hoje"].includes(mesAno)) {
        resumo = await lancamentosService.getResumoDoDia(userId);
        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        await sock.sendMessage(userId, {
            text: `📊 *Resumo de hoje (${hoje})*\nReceitas: R$ ${(0, formatUtils_1.formatarValor)(resumo.totalReceitas)}\nDespesas: R$ ${(0, formatUtils_1.formatarValor)(resumo.totalDespesas)}\nSaldo: R$ ${(0, formatUtils_1.formatarValor)(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
        });
        return;
    }
    // Resumo do mês atual
    if (!mesAno || ["do mes atual", "do mês atual", "mes atual", "mês atual", "atual", "deste mes", "deste mês", "deste mes atual", "deste mês atual"].includes(mesAno)) {
        resumo = await lancamentosService.getResumoDoMesAtual(userId);
        await sock.sendMessage(userId, {
            text: `📊 *Resumo do mês atual*\nReceitas: R$ ${(0, formatUtils_1.formatarValor)(resumo.totalReceitas)}\nDespesas: R$ ${(0, formatUtils_1.formatarValor)(resumo.totalDespesas)}\nSaldo: R$ ${(0, formatUtils_1.formatarValor)(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
        });
        return;
    }
    // Resumo de mês/ano específico
    const parsed = (0, dataUtils_1.parseMesAno)(mesAno);
    if (!parsed) {
        await sock.sendMessage(userId, {
            text: '❌ Formato inválido. Use:\n• resumo (mês atual)\n• resumo hoje (dia atual)\n• resumo 03/2024 (mês específico)\n\n💡 *Variações aceitas:*\n• resumo do mes atual\n• resumo do dia\n• resumo atual\n• resumo hoje'
        });
        return;
    }
    resumo = await lancamentosService.getResumoPorMes(userId, parsed.mes, parsed.ano);
    await sock.sendMessage(userId, {
        text: `📊 *Resumo de ${(0, dataUtils_1.getNomeMes)(parsed.mes - 1)}/${parsed.ano}*\nReceitas: R$ ${(0, formatUtils_1.formatarValor)(resumo.totalReceitas)}\nDespesas: R$ ${(0, formatUtils_1.formatarValor)(resumo.totalDespesas)}\nSaldo: R$ ${(0, formatUtils_1.formatarValor)(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
    });
}
exports.default = resumoCommand;
//# sourceMappingURL=resumo.js.map