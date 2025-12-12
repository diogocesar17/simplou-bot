import Redis from 'ioredis';

// Tipagem genérica e simples para dados do estado
export interface UserState<T extends Record<string, unknown> = Record<string, unknown>> {
  etapa: string;
  dadosParciais?: T;
}

// Usa variável de ambiente ou fallback para local
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const prefixo = 'estado:'; // prefixo usado nas chaves do Redis

/**
 * Define o estado atual de um usuário
 * @param {string} userId - ID único do usuário
 * @param {string} etapa - Ex: 'aguardando_nome_cartao'
 * @param {object} dadosParciais - Qualquer dado complementar
 * @param {number} ttlSegundos - Tempo de expiração (padrão: 600s)
 */
async function definirEstado<T extends Record<string, unknown>>(userId: string, etapa: string, dadosParciais: T = {} as T, ttlSegundos: number = 600): Promise<void> {
  const valor: UserState<T> = { etapa, dadosParciais };
  await redis.set(`${prefixo}${userId}`, JSON.stringify(valor), 'EX', ttlSegundos);
}

/**
 * Obtém o estado atual de um usuário
 * @param {string} userId
 * @returns {Promise<{etapa: string, dadosParciais?: object} | null>}
 */
async function obterEstado<T extends Record<string, unknown>>(userId: string): Promise<UserState<T> | null> {
  const valor = await redis.get(`${prefixo}${userId}`);
  return valor ? (JSON.parse(valor) as UserState<T>) : null;
}

/**
 * Limpa o estado do usuário
 * @param {string} userId
 */
async function limparEstado(userId: string): Promise<void> {
  await redis.del(`${prefixo}${userId}`);
}

export {
  definirEstado,
  obterEstado,
  limparEstado
}; 
