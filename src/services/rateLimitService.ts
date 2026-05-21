import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const LIMITE_MENSAGENS = 40;
const JANELA_SEGUNDOS = 3600;

/**
 * Verifica se o usuário pode enviar mais mensagens dentro da janela de 1 hora.
 * Retorna true se permitido, false se o limite foi atingido.
 */
export async function verificarRateLimit(userId: string): Promise<boolean> {
  const chave = `ratelimit:${userId}`;
  const total = await redis.incr(chave);
  if (total === 1) {
    await redis.expire(chave, JANELA_SEGUNDOS);
  }
  return total <= LIMITE_MENSAGENS;
}
