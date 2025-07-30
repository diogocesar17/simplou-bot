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
// Comando para remover usuário (apenas para admins)
const usuariosService = __importStar(require("../services/usuariosService"));
async function removerUsuarioCommand(sock, userId, texto) {
    try {
        // Verificar se o usuário é admin
        const isAdmin = await usuariosService.verificarAdmin(userId);
        if (!isAdmin) {
            await sock.sendMessage(userId, {
                text: '❌ Acesso negado. Apenas administradores podem remover usuários.'
            });
            return;
        }
        // Processar comando de remoção
        const resultado = await usuariosService.processarComandoRemover(texto, userId);
        // Enviar resposta
        await sock.sendMessage(userId, { text: resultado.message });
    }
    catch (error) {
        console.error('Erro no comando removerUsuario:', error);
        await sock.sendMessage(userId, {
            text: '❌ Erro interno ao processar comando de remoção.'
        });
    }
}
exports.default = removerUsuarioCommand;
//# sourceMappingURL=removerUsuario.js.map