import Redis from 'ioredis';
import { BufferJSON } from '@whiskeysockets/baileys';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const AUTH_KEY_CRED = 'wa:auth:credentials';
const AUTH_KEY_KEYS = 'wa:auth:keys';

async function saveAuthState(creds, keys) {
  try {
    if (!creds || !keys) {
      console.warn('⚠️ Credenciais ou chaves vazias, não salvando.');
      return;
    }

    const credsStr = JSON.stringify(creds, BufferJSON.replacer);
    const keysStr = JSON.stringify(keys, BufferJSON.replacer);

    await redis.set(AUTH_KEY_CRED, credsStr);
    await redis.set(AUTH_KEY_KEYS, keysStr);

    console.log('✅ Sessão salva no Redis');
  } catch (err: any) {
    console.error('❌ Erro ao salvar no Redis:', err.message);
  }
}

async function loadAuthState() {
  try {
    const credStr = await redis.get(AUTH_KEY_CRED);
    const keyStr = await redis.get(AUTH_KEY_KEYS);

    if (!credStr || !keyStr) {
      console.warn('⚠️ Sessão ausente no Redis');
      return null;
    }

    return {
      creds: JSON.parse(credStr, BufferJSON.reviver),
      keys: JSON.parse(keyStr, BufferJSON.reviver),
    };
  } catch (err: any) {
    console.error('❌ Erro ao carregar do Redis:', err.message);
    return null;
  }
}

async function getHybridAuthState() {
  // Sempre usa o estado nativo do Baileys (MultiFile), que fornece `keys.get/set`
  const { useMultiFileAuthState } = await import('@whiskeysockets/baileys');
  const { state, saveCreds: saveCredsLocal } = await useMultiFileAuthState('auth');

  // Tenta carregar sessão do Redis para evitar re-pareamento
  const redisState = await loadAuthState();
  if (redisState?.creds) {
    try {
      // Hidrata apenas creds; não substitui o store de keys (precisa manter interface get/set)
      state.creds = redisState.creds;
      console.log('🔄 Credenciais carregadas do Redis (hidratação parcial).');
    } catch (e) {
      console.warn('⚠️ Falha ao hidratar creds do Redis, seguindo com estado local:', (e as any)?.message || e);
    }
  }

  // Wrap de persistência híbrida: salva no Redis e no filesystem
  const saveCreds = async () => {
    try {
      await saveAuthState(state.creds, state.keys);
    } catch (e) {
      console.warn('⚠️ Falha ao salvar sessão no Redis:', (e as any)?.message || e);
    }
    await saveCredsLocal();
    console.log('✅ Sessão salva no Redis e localmente.');
  };

  return { state, saveCreds };
}

export {
  getHybridAuthState,
};
