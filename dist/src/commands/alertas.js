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
const alertasService = __importStar(require("../services/alertasService"));
const logger_1 = require("../../logger");
/**
 * Comando para verificar alertas do usuário
 * @param {object} sock - Socket do WhatsApp
 * @param {string} userId - ID do usuário
 */
async function alertasCommand(sock, userId) {
    try {
        logger_1.logger.info(`Verificando alertas para usuário: ${userId}`);
        // Verificar se há alertas
        const temAlertas = await alertasService.temAlertas(userId);
        if (!temAlertas) {
            await sock.sendMessage(userId, {
                text: `✅ *Nenhum alerta encontrado!*\n\n` +
                    `🎉 Você está em dia com seus compromissos.\n` +
                    `💡 Os alertas são verificados automaticamente todos os dias.`
            });
            return;
        }
        // Buscar todos os alertas
        const mensagemAlertas = await alertasService.buscarTodosAlertas(userId);
        if (mensagemAlertas) {
            await sock.sendMessage(userId, {
                text: mensagemAlertas + `\n\n💡 *Dica:* Use "vencimentos" para ver todos os próximos vencimentos.`
            });
        }
        else {
            await sock.sendMessage(userId, {
                text: `❌ Erro ao buscar alertas. Tente novamente.`
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Erro no comando de alertas:', error);
        await sock.sendMessage(userId, {
            text: `❌ Erro interno. Tente novamente.`
        });
    }
}
exports.default = alertasCommand;
//# sourceMappingURL=alertas.js.map