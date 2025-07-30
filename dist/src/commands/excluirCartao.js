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
const cartoesService = __importStar(require("../services/cartoesService"));
// Contexto simples em memória
const aguardandoExclusaoCartao = {};
async function excluirCartaoCommand(sock, userId, texto) {
    // 1. Se está aguardando escolha do cartão
    if (aguardandoExclusaoCartao[userId] && !aguardandoExclusaoCartao[userId].cartaoEscolhido) {
        const escolha = texto.trim();
        if (escolha.toLowerCase() === 'cancelar') {
            delete aguardandoExclusaoCartao[userId];
            await sock.sendMessage(userId, { text: '❌ Exclusão de cartão cancelada.' });
            return;
        }
        const idx = parseInt(escolha);
        const cartoes = aguardandoExclusaoCartao[userId].cartoes;
        if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
            await sock.sendMessage(userId, { text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".` });
            return;
        }
        const cartaoEscolhido = cartoes[idx - 1];
        // Verificar lançamentos associados (mock: 0)
        const totalLancamentos = await cartoesService.contarLancamentosAssociadosCartao(userId, cartaoEscolhido.nome_cartao);
        let msgConfirmacao = `🗑️ *Confirmar exclusão do cartão*\n\n`;
        msgConfirmacao += `💳 Cartão: ${cartaoEscolhido.nome_cartao}\n`;
        msgConfirmacao += `📅 Vencimento: dia ${cartaoEscolhido.dia_vencimento}\n`;
        if (cartaoEscolhido.dia_fechamento) {
            msgConfirmacao += `📅 Fechamento: dia ${cartaoEscolhido.dia_fechamento}\n`;
        }
        msgConfirmacao += `📊 Lançamentos associados: ${totalLancamentos}\n\n`;
        if (totalLancamentos > 0) {
            msgConfirmacao += `⚠️ *ATENÇÃO:* Este cartão possui ${totalLancamentos} lançamento(s) associado(s).\n`;
            msgConfirmacao += `Os lançamentos continuarão existindo, mas ficarão sem referência ao cartão.\n\n`;
        }
        msgConfirmacao += `❓ Confirma a exclusão?\nDigite "sim" para confirmar ou "cancelar" para abortar.`;
        aguardandoExclusaoCartao[userId].cartaoEscolhido = cartaoEscolhido;
        aguardandoExclusaoCartao[userId].totalLancamentos = totalLancamentos;
        await sock.sendMessage(userId, { text: msgConfirmacao });
        return;
    }
    // 2. Se está aguardando confirmação
    if (aguardandoExclusaoCartao[userId] && aguardandoExclusaoCartao[userId].cartaoEscolhido) {
        const confirmacao = texto.trim().toLowerCase();
        if (confirmacao === 'cancelar') {
            delete aguardandoExclusaoCartao[userId];
            await sock.sendMessage(userId, { text: '❌ Exclusão de cartão cancelada.' });
            return;
        }
        if (confirmacao !== 'sim') {
            await sock.sendMessage(userId, { text: '❌ Confirmação inválida. Digite "sim" para confirmar ou "cancelar" para abortar.' });
            return;
        }
        const cartao = aguardandoExclusaoCartao[userId].cartaoEscolhido;
        const totalLancamentos = aguardandoExclusaoCartao[userId].totalLancamentos;
        await cartoesService.excluirCartaoConfigurado(userId, cartao.nome_cartao);
        let msgSucesso = `✅ Cartão excluído com sucesso!\n\n`;
        msgSucesso += `💳 Cartão: ${cartao.nome_cartao}\n`;
        msgSucesso += `📊 Lançamentos associados: ${totalLancamentos}\n\n`;
        if (totalLancamentos > 0) {
            msgSucesso += `ℹ️ Os ${totalLancamentos} lançamento(s) associado(s) continuam no sistema, mas sem referência ao cartão.\n`;
            msgSucesso += `Para limpar completamente, você pode editar os lançamentos individualmente.`;
        }
        await sock.sendMessage(userId, { text: msgSucesso });
        delete aguardandoExclusaoCartao[userId];
        return;
    }
    // 3. Início do fluxo: listar cartões
    const cartoes = await cartoesService.listarCartoesConfigurados(userId);
    if (!cartoes || cartoes.length === 0) {
        await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado para excluir.' });
        return;
    }
    let msgCartoes = 'Qual cartão deseja excluir?\n';
    cartoes.forEach((cartao, idx) => {
        msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
    });
    msgCartoes += '\nDigite o número do cartão ou "cancelar"';
    aguardandoExclusaoCartao[userId] = { cartoes };
    await sock.sendMessage(userId, { text: msgCartoes });
}
exports.default = excluirCartaoCommand;
//# sourceMappingURL=excluirCartao.js.map