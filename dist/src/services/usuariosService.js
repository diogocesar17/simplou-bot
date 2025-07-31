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
exports.cadastrarUsuario = cadastrarUsuario;
exports.listarUsuarios = listarUsuarios;
exports.buscarUsuario = buscarUsuario;
exports.promoverParaPremium = promoverParaPremium;
exports.removerUsuario = removerUsuario;
exports.verificarAcessoUsuario = verificarAcessoUsuario;
exports.registrarAcesso = registrarAcesso;
exports.buscarUsuariosPremiumExpiracao = buscarUsuariosPremiumExpiracao;
exports.verificarAdmin = verificarAdmin;
exports.processarComandoUsuarios = processarComandoUsuarios;
exports.processarComandoRemover = processarComandoRemover;
// @ts-nocheck
const databaseService = __importStar(require("../../databaseService"));
// TODO: Tipar corretamente. Usar any onde necessário.
// Funções para gerenciar usuários
async function cadastrarUsuario(userId, dados) {
    return await databaseService.cadastrarUsuario(userId, dados);
}
async function listarUsuarios() {
    return await databaseService.listarUsuarios();
}
async function buscarUsuario(userId) {
    return await databaseService.buscarUsuario(userId);
}
async function promoverParaPremium(userId, dataExpiracao) {
    return await databaseService.promoverParaPremium(userId, dataExpiracao);
}
async function removerUsuario(userId) {
    return await databaseService.removerUsuario(userId);
}
async function verificarAcessoUsuario(userId) {
    return await databaseService.verificarAcessoUsuario(userId);
}
async function registrarAcesso(userId) {
    return await databaseService.registrarAcesso(userId);
}
async function buscarUsuariosPremiumExpiracao(dias = 7) {
    return await databaseService.buscarUsuariosPremiumExpiracao(dias);
}
// Função para verificar se usuário é admin
async function verificarAdmin(userId) {
    const { ADMIN_USERS } = require('../../config');
    return ADMIN_USERS.includes(userId);
}
// Função para processar comando de listagem de usuários
async function processarComandoUsuarios() {
    try {
        const usuarios = await databaseService.listarUsuarios();
        if (!usuarios || usuarios.length === 0) {
            return {
                success: false,
                message: '📄 Nenhum usuário encontrado no sistema.'
            };
        }
        let message = '👥 *Lista de Usuários:*\n\n';
        usuarios.forEach((usuario, index) => {
            const status = usuario.status === 'ativo' ? '✅' : '❌';
            const plano = usuario.plano === 'premium' ? '👑' : '📱';
            const admin = usuario.is_admin ? '👨‍💼' : '';
            message += `${index + 1}. ${status} ${plano} ${admin} *${usuario.nome || 'Sem nome'}*\n`;
            message += `   📱 ID: \`${usuario.user_id}\`\n`;
            message += `   📊 Plano: ${usuario.plano}\n`;
            message += `   📅 Status: ${usuario.status}\n`;
            if (usuario.criado_em) {
                message += `   🕐 Criado: ${new Date(usuario.criado_em).toLocaleDateString('pt-BR')}\n`;
            }
            message += '\n';
        });
        message += `📊 *Total: ${usuarios.length} usuário(s)*`;
        return {
            success: true,
            message
        };
    }
    catch (error) {
        console.error('Erro ao processar comando usuários:', error);
        return {
            success: false,
            message: '❌ Erro interno ao listar usuários.'
        };
    }
}
// Função para processar comando de remoção de usuário
async function processarComandoRemover(texto, adminId) {
    try {
        // Extrair ID do usuário do texto
        const match = texto.match(/remover\s+(.+)/i);
        if (!match) {
            return {
                success: false,
                message: '❌ Formato inválido. Use: *remover <ID_DO_USUARIO>*\n\n💡 *Exemplo:* remover 556193096344@s.whatsapp.net'
            };
        }
        const userIdParaRemover = match[1].trim();
        // Verificar se não está tentando remover a si mesmo
        if (userIdParaRemover === adminId) {
            return {
                success: false,
                message: '❌ Você não pode remover a si mesmo.'
            };
        }
        // Verificar se o usuário existe
        const usuario = await databaseService.buscarUsuario(userIdParaRemover);
        if (!usuario) {
            return {
                success: false,
                message: '❌ Usuário não encontrado no sistema.'
            };
        }
        // Verificar se não está tentando remover outro admin
        if (usuario.is_admin) {
            return {
                success: false,
                message: '❌ Não é possível remover outro administrador.'
            };
        }
        // Remover usuário
        const resultado = await databaseService.removerUsuario(userIdParaRemover, adminId);
        if (resultado) {
            return {
                success: true,
                message: `✅ *Usuário removido com sucesso!*\n\n📱 ID: \`${userIdParaRemover}\`\n👤 Nome: ${usuario.nome || 'Sem nome'}\n📊 Plano: ${usuario.plano}\n👨‍💼 Removido por: ${adminId}`
            };
        }
        else {
            return {
                success: false,
                message: '❌ Erro ao remover usuário. Tente novamente.'
            };
        }
    }
    catch (error) {
        console.error('Erro ao processar comando remover:', error);
        return {
            success: false,
            message: '❌ Erro interno ao processar remoção.'
        };
    }
}
//# sourceMappingURL=usuariosService.js.map