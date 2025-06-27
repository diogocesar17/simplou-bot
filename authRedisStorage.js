const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

// Configuração do Redis (opcional)
let redis = null;
if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL);
    
    // Testar conexão
    redis.on('error', (err) => {
      console.warn('⚠️ Redis não disponível, usando armazenamento local:', err.message);
      redis = null;
    });
    
    console.log('🔌 Redis configurado');
  } catch (err) {
    console.warn('⚠️ Redis não disponível, usando armazenamento local:', err.message);
    redis = null;
  }
}

const AUTH_KEY_CRED = 'wa:auth:credentials';
const AUTH_KEY_KEYS = 'wa:auth:keys';

async function saveAuthState(creds, keys) {
  if (redis) {
    try {
      await redis.set(AUTH_KEY_CRED, JSON.stringify(BufferJSON.replacer(creds)));
      await redis.set(AUTH_KEY_KEYS, JSON.stringify(BufferJSON.replacer(keys)));
      console.log('✅ Sessão salva no Redis');
    } catch (err) {
      console.warn('⚠️ Erro ao salvar no Redis, usando local:', err.message);
    }
  }
}

async function loadAuthState() {
  if (!redis) {
    return null;
  }
  
  try {
    const credData = await redis.get(AUTH_KEY_CRED);
    const keyData = await redis.get(AUTH_KEY_KEYS);

    if (!credData || !keyData) {
      console.log('🚫 Sessão não encontrada no Redis');
      return null;
    }

    console.log('📦 Sessão carregada do Redis');
    return {
      creds: BufferJSON.reviver(JSON.parse(credData), ''),
      keys: BufferJSON.reviver(JSON.parse(keyData), ''),
    };
  } catch (err) {
    console.warn('⚠️ Erro ao carregar do Redis:', err.message);
    return null;
  }
}

async function getHybridAuthState() {
  const redisState = await loadAuthState();

  if (!redisState) {
    console.log('📌 Sessão ausente no Redis. Iniciando login...');
    const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    return {
      state,
      saveCreds: async () => {
        await saveAuthState(state.creds, state.keys);
        await saveCreds();
        console.log('✅ Sessão salva no Redis e localmente.');
      }
    };
  }

  return {
    state: redisState,
    saveCreds: async () => {
      await saveAuthState(redisState.creds, redisState.keys);
    }
  };
}

module.exports = {
  getHybridAuthState
};
