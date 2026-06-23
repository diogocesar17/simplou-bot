import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const LIMITE_MENSAGENS = 40;
const JANELA_SEGUNDOS = 3600;

const LIMITE_GEMINI_DIA = 30;
const LIMITE_LANCAMENTOS_DIA = 100;

function diaAtualSP(): string {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
}

export async function verificarRateLimit(userId: string): Promise<boolean> {
  const chave = `ratelimit:${userId}`;
  const total = await redis.incr(chave);
  if (total === 1) {
    await redis.expire(chave, JANELA_SEGUNDOS);
  }
  return total <= LIMITE_MENSAGENS;
}

export async function verificarLimiteGeminiDia(userId: string): Promise<boolean> {
  const chave = `gemini_dia:${userId}:${diaAtualSP()}`;
  const total = parseInt((await redis.get(chave)) || '0', 10);
  return total < LIMITE_GEMINI_DIA;
}

export async function incrementarGeminiDia(userId: string): Promise<void> {
  const chave = `gemini_dia:${userId}:${diaAtualSP()}`;
  const total = await redis.incr(chave);
  if (total === 1) await redis.expire(chave, 86400);
}

export async function verificarLimiteLancamentosDia(userId: string): Promise<boolean> {
  const chave = `lancamentos_dia:${userId}:${diaAtualSP()}`;
  const total = parseInt((await redis.get(chave)) || '0', 10);
  return total < LIMITE_LANCAMENTOS_DIA;
}

export async function incrementarLancamentosDia(userId: string): Promise<void> {
  const chave = `lancamentos_dia:${userId}:${diaAtualSP()}`;
  const total = await redis.incr(chave);
  if (total === 1) await redis.expire(chave, 86400);
}
