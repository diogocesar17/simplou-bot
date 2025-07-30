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
exports.registrarLog = registrarLog;
exports.buscarLogsRecentes = buscarLogsRecentes;
exports.gerarLogAuditoria = gerarLogAuditoria;
exports.gerarEstatisticasSistema = gerarEstatisticasSistema;
exports.gerarBackupCSV = gerarBackupCSV;
exports.limparDadosAntigos = limparDadosAntigos;
exports.migrarUsuariosConfig = migrarUsuariosConfig;
exports.queryDatabase = queryDatabase;
exports.contarLancamentos = contarLancamentos;
// @ts-nocheck
const databaseService = __importStar(require("../../databaseService"));
// TODO: Tipar corretamente. Usar any onde necessário.
// Funções para logs e auditoria
async function registrarLog(userId, acao, detalhes) {
    return await databaseService.registrarLog(userId, acao, detalhes);
}
async function buscarLogsRecentes(userId, limite = 50) {
    return await databaseService.buscarLogsRecentes(userId, limite);
}
async function gerarLogAuditoria(userId, periodo = 'recentes') {
    const limite = periodo === 'todos' ? 1000 : 100;
    const resultado = await databaseService.gerarLogAuditoria(limite);
    if (resultado && resultado.csv) {
        // Salvar arquivo CSV
        const fs = require('fs').promises;
        const path = require('path');
        // Criar diretório de logs se não existir
        const logsDir = path.join(process.cwd(), 'logs');
        try {
            await fs.mkdir(logsDir, { recursive: true });
        }
        catch (error) {
            // Diretório já existe ou erro de permissão
        }
        // Gerar nome do arquivo com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const nomeArquivo = `logs_auditoria_${timestamp}.csv`;
        const caminhoArquivo = path.join(logsDir, nomeArquivo);
        // Salvar arquivo CSV
        await fs.writeFile(caminhoArquivo, resultado.csv, 'utf8');
        return {
            sucesso: true,
            nomeArquivo,
            caminhoArquivo,
            total: resultado.total,
            tamanho: Math.round(resultado.csv.length / 1024)
        };
    }
    return resultado;
}
// Funções para estatísticas do sistema
async function gerarEstatisticasSistema() {
    return await databaseService.gerarEstatisticasSistema();
}
// Funções para backup e limpeza
async function gerarBackupCSV(userId) {
    return await databaseService.gerarBackupCSV(userId);
}
async function limparDadosAntigos(dias = 365) {
    return await databaseService.limparDadosAntigos(dias);
}
// Funções para migração de dados
async function migrarUsuariosConfig() {
    return await databaseService.migrarUsuariosConfig();
}
// Funções para consultas diretas
async function queryDatabase(query, params = []) {
    return await databaseService.queryDatabase(query, params);
}
// Função para contar lançamentos
async function contarLancamentos() {
    const result = await databaseService.queryDatabase('SELECT COUNT(*) as total FROM lancamentos');
    return result[0]?.total || 0;
}
//# sourceMappingURL=sistemaService.js.map