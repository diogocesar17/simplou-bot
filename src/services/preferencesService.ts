import { getUserPreference, setUserPreference } from '../infrastructure/databaseService';

export interface MoedaConfig {
  codigo: string;
  simbolo: string;
  nome: string;
}

export const MOEDAS: Record<string, MoedaConfig> = {
  BRL: { codigo: 'BRL', simbolo: 'R$', nome: 'Real brasileiro' },
  EUR: { codigo: 'EUR', simbolo: '€', nome: 'Euro' },
  USD: { codigo: 'USD', simbolo: 'US$', nome: 'Dólar americano' },
  GBP: { codigo: 'GBP', simbolo: '£', nome: 'Libra esterlina' },
};

// Cache em memória simples (TTL de 5 minutos por usuário)
const cache = new Map<string, { simbolo: string; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getMoeda(userId: string): Promise<MoedaConfig> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return MOEDAS[cached.simbolo] ?? MOEDAS.BRL;
  }

  const codigo = await getUserPreference(userId, 'moeda') ?? 'BRL';
  const moeda = MOEDAS[codigo] ?? MOEDAS.BRL;
  cache.set(userId, { simbolo: moeda.codigo, ts: Date.now() });
  return moeda;
}

export async function setMoeda(userId: string, codigo: string): Promise<MoedaConfig | null> {
  const moeda = MOEDAS[codigo.toUpperCase()];
  if (!moeda) return null;
  await setUserPreference(userId, 'moeda', moeda.codigo);
  cache.set(userId, { simbolo: moeda.codigo, ts: Date.now() });
  return moeda;
}

export function invalidarCacheMoeda(userId: string): void {
  cache.delete(userId);
}
