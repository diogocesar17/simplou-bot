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
const usuariosService = __importStar(require("../services/usuariosService"));
const sistemaService = __importStar(require("../services/sistemaService"));
const config_1 = require("../../config");
async function statusCommand(sock, userId) {
    // Buscar informações reais do sistema
    const totalLancamentos = await sistemaService.contarLancamentos();
    const usuarios = await usuariosService.listarUsuarios();
    const totalUsuarios = usuarios.length;
    const totalAdmins = usuarios.filter(u => u.is_admin).length;
    const totalPremium = usuarios.filter(u => u.plano === 'premium').length;
    const msg = `📊 *Status do Sistema*\n\n` +
        `👥 Usuários: ${totalUsuarios}\n` +
        `👑 Admins: ${totalAdmins}\n` +
        `💎 Premium: ${totalPremium}\n` +
        `📋 Total de lançamentos: ${totalLancamentos}\n` +
        `🤖 Versão: ${config_1.SYSTEM_CONFIG?.VERSION || '1.0.0'}\n` +
        `⏰ Última verificação: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    await sock.sendMessage(userId, { text: msg });
}
exports.default = statusCommand;
//# sourceMappingURL=status.js.map