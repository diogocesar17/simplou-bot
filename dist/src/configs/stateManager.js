"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.definirEstado = definirEstado;
exports.obterEstado = obterEstado;
exports.limparEstado = limparEstado;
const ioredis_1 = __importDefault(require("ioredis"));
// Usa variável de ambiente ou fallback para local
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
const prefixo = 'estado:'; // prefixo usado nas chaves do Redis
/**
 * Define o estado atual de um usuário
 * @param {string} userId - ID único do usuário
 * @param {string} etapa - Ex: 'aguardando_nome_cartao'
 * @param {object} dadosParciais - Qualquer dado complementar
 * @param {number} ttlSegundos - Tempo de expiração (padrão: 600s)
 */
async function definirEstado(userId, etapa, dadosParciais = {}, ttlSegundos = 600) {
    const valor = { etapa, dadosParciais };
    await redis.set(`${prefixo}${userId}`, JSON.stringify(valor), 'EX', ttlSegundos);
}
/**
 * Obtém o estado atual de um usuário
 * @param {string} userId
 * @returns {Promise<{etapa: string, dadosParciais?: object} | null>}
 */
async function obterEstado(userId) {
    const valor = await redis.get(`${prefixo}${userId}`);
    return valor ? JSON.parse(valor) : null;
}
/**
 * Limpa o estado do usuário
 * @param {string} userId
 */
async function limparEstado(userId) {
    await redis.del(`${prefixo}${userId}`);
}
//# sourceMappingURL=stateManager.js.map