import { AsyncLocalStorage } from 'async_hooks';

interface UserContext {
  simboloMoeda: string;
}

const storage = new AsyncLocalStorage<UserContext>();

export function runWithUserContext<T>(ctx: UserContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

// Retorna o símbolo da moeda do usuário atual (ex: 'R$', '€').
// Fallback para 'R$' se chamado fora de um contexto ativo.
export function getMoedaCtx(): string {
  return storage.getStore()?.simboloMoeda ?? 'R$';
}
