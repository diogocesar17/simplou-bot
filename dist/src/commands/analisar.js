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
const geminiService = __importStar(require("../services/geminiService"));
const lancamentosService = __importStar(require("../services/lancamentosService"));
async function analisarCommand(sock, userId) {
    // Buscar dados dos últimos 3 meses (como no fluxo original)
    const dados = await lancamentosService.buscarDadosParaAnalise(userId, 3);
    if (!dados || dados.length === 0) {
        await sock.sendMessage(userId, { text: '❌ Não há dados suficientes para análise. Registre lançamentos de pelo menos 2 meses primeiro.' });
        return;
    }
    // Gerar análise usando IA real
    const analise = await geminiService.analisarPadroesGastos(userId, dados);
    await sock.sendMessage(userId, { text: analise });
}
exports.default = analisarCommand;
//# sourceMappingURL=analisar.js.map