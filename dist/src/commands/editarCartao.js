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
async function editarCartaoCommand(sock, userId, texto) {
    const textoLimpo = texto.trim().toLowerCase();
    const estado = await (0, stateManager_1.obterEstado)(userId);
    // 1. Se está aguardando escolha do cartão
    if (estado?.etapa === 'aguardando_escolha_edicao_cartao') {
        if (textoLimpo === 'cancelar') {
            await (0, stateManager_1.limparEstado)(userId);
            await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
            return;
        }
        const idx = parseInt(texto);
        const cartoes = estado.dadosParciais.cartoes;
        if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
            await sock.sendMessage(userId, {
                text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".`
            });
            return;
        }
        const cartaoEscolhido = cartoes[idx - 1];
        await (0, stateManager_1.definirEstado)(userId, 'aguardando_campo_edicao_cartao', { cartaoEscolhido });
        await sock.sendMessage(userId, {
            text: 'Qual campo deseja editar?\n1. vencimento\n2. fechamento\n3. cancelar'
        });
        return;
    }
    // 2. Se está aguardando escolha do campo
    if (estado?.etapa === 'aguardando_campo_edicao_cartao') {
        let campo = textoLimpo;
        if (["1", "vencimento"].includes(campo))
            campo = 'vencimento';
        else if (["2", "fechamento"].includes(campo))
            campo = 'fechamento';
        else if (["3", "cancelar"].includes(campo))
            campo = 'cancelar';
        if (campo === 'cancelar') {
            await (0, stateManager_1.limparEstado)(userId);
            await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
            return;
        }
        if (!['vencimento', 'fechamento'].includes(campo)) {
            await sock.sendMessage(userId, {
                text: '❌ Campo inválido. Digite: 1, 2, 3 ou o nome do campo.'
            });
            return;
        }
        const dados = {
            ...estado.dadosParciais,
            campoEscolhido: campo
        };
        await (0, stateManager_1.definirEstado)(userId, 'aguardando_novo_valor_edicao_cartao', dados);
        await sock.sendMessage(userId, {
            text: `Digite o novo dia de ${campo} (1-31):`
        });
        return;
    }
    // 3. Se está aguardando o novo valor
    if (estado?.etapa === 'aguardando_novo_valor_edicao_cartao') {
        const campo = estado.dadosParciais.campoEscolhido;
        const cartao = estado.dadosParciais.cartaoEscolhido;
        const dia = parseInt(texto);
        if (isNaN(dia) || dia < 1 || dia > 31) {
            await sock.sendMessage(userId, {
                text: `❌ Dia de ${campo} inválido. Digite um número entre 1 e 31.`
            });
            return;
        }
        // Atualizar campo
        let novoVencimento = cartao.dia_vencimento;
        let novoFechamento = cartao.dia_fechamento;
        if (campo === 'vencimento')
            novoVencimento = dia;
        if (campo === 'fechamento')
            novoFechamento = dia;
        await cartoesService.atualizarCartaoConfigurado(userId, cartao.nome_cartao, novoVencimento, novoFechamento);
        await (0, stateManager_1.limparEstado)(userId);
        await sock.sendMessage(userId, {
            text: `✅ Cartão ${cartao.nome_cartao} atualizado!\n💳 Vencimento: dia ${novoVencimento}\n📅 Fechamento: dia ${novoFechamento}`
        });
        return;
    }
    // 4. Início do fluxo: listar cartões
    const cartoes = await cartoesService.listarCartoesConfigurados(userId);
    if (!cartoes || cartoes.length === 0) {
        await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado para editar.' });
        return;
    }
    let msgCartoes = 'Qual cartão deseja editar?\n';
    cartoes.forEach((cartao, idx) => {
        msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
    });
    msgCartoes += '\nDigite o número do cartão ou "cancelar"';
    await (0, stateManager_1.definirEstado)(userId, 'aguardando_escolha_edicao_cartao', { cartoes });
    await sock.sendMessage(userId, { text: msgCartoes });
}
exports.default = editarCartaoCommand;
//# sourceMappingURL=editarCartao.js.map