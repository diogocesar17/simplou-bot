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
const stateManager_1 = require("./../configs/stateManager");
const cartoesService = __importStar(require("../services/cartoesService"));
async function configurarCartaoCommand(sock, userId, texto) {
    const textoLimpo = texto.trim().toLowerCase();
    const estado = await (0, stateManager_1.obterEstado)(userId);
    // 1. Se está aguardando nome do cartão
    if (estado?.etapa === 'aguardando_nome_cartao') {
        if (textoLimpo === 'cancelar') {
            await (0, stateManager_1.limparEstado)(userId);
            await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
            return;
        }
        if (texto.length < 2 || texto.length > 20) {
            await sock.sendMessage(userId, { text: '❌ Nome do cartão inválido. Digite um nome entre 2 e 20 caracteres ou "cancelar".' });
            return;
        }
        const dados = { nomeCartao: texto.trim() };
        await (0, stateManager_1.definirEstado)(userId, 'aguardando_vencimento_cartao', dados);
        await sock.sendMessage(userId, { text: `💳 Qual dia vence a fatura do ${dados.nomeCartao}? (1-31)\nExemplo: 15` });
        return;
    }
    // 2. Se está aguardando o vencimento
    if (estado?.etapa === 'aguardando_vencimento_cartao') {
        if (textoLimpo === 'cancelar') {
            await (0, stateManager_1.limparEstado)(userId);
            await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
            return;
        }
        const dia = parseInt(texto.trim());
        if (isNaN(dia) || dia < 1 || dia > 31) {
            await sock.sendMessage(userId, { text: '❌ Dia inválido. Digite um número entre 1 e 31 ou "cancelar".' });
            return;
        }
        const dados = {
            ...estado.dadosParciais,
            diaVencimento: dia
        };
        await (0, stateManager_1.definirEstado)(userId, 'aguardando_fechamento_cartao', dados);
        await sock.sendMessage(userId, {
            text: `📅 Qual dia de fechamento da fatura do ${dados.nomeCartao}? (1-31)\nExemplo: 7\nOu digite "padrão" para usar 7 dias antes do vencimento.`
        });
        return;
    }
    // 3. Se está aguardando o fechamento
    if (estado?.etapa === 'aguardando_fechamento_cartao') {
        if (textoLimpo === 'cancelar') {
            await (0, stateManager_1.limparEstado)(userId);
            await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
            return;
        }
        let diaFechamento;
        if (['padrao', 'padrão'].includes(textoLimpo)) {
            diaFechamento = estado.dadosParciais.diaVencimento - 7;
            if (diaFechamento < 1)
                diaFechamento = 1;
        }
        else {
            diaFechamento = parseInt(texto);
            if (isNaN(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) {
                await sock.sendMessage(userId, {
                    text: '❌ Dia de fechamento inválido. Digite um número entre 1 e 31, ou "padrão".'
                });
                return;
            }
        }
        const { nomeCartao, diaVencimento } = estado.dadosParciais;
        await cartoesService.salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento);
        await (0, stateManager_1.limparEstado)(userId);
        await sock.sendMessage(userId, {
            text: `✅ Cartão ${nomeCartao} configurado com sucesso!\n\n💳 Vencimento: dia ${diaVencimento}\n📅 Fechamento: dia ${diaFechamento}`
        });
        return;
    }
    // 4. Início do fluxo
    await (0, stateManager_1.definirEstado)(userId, 'aguardando_nome_cartao');
    await sock.sendMessage(userId, {
        text: '💳 Qual o nome do cartão? (Exemplo: Nubank, Itaú, Inter)\n\nDigite "cancelar" para abortar.'
    });
}
exports.default = configurarCartaoCommand;
//# sourceMappingURL=configurarCartao.js.map