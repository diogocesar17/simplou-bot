const Redis = require('ioredis');
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

const redis = new Redis(process.env.REDIS_URL);

const AUTH_KEY_CRED = 'wa:auth:credentials';
const AUTH_KEY_KEYS = 'wa:auth:keys';

async function saveAuthState(creds, keys) {
  try {
    await redis.set(AUTH_KEY_CRED, JSON.stringify(BufferJSON.replacer(creds)));
    await redis.set(AUTH_KEY_KEYS, JSON.stringify(BufferJSON.replacer(keys)));
    console.log('✅ Sessão salva no Redis');
  } catch (err) {
    console.error('❌ Erro ao salvar sessão no Redis:', err);
  }
}

async function loadAuthState() {
  const credData = await redis.get(AUTH_KEY_CRED);
  const keyData = await redis.get(AUTH_KEY_KEYS);

  /**REMOVER */
  if (!credData || !keyData) {
    console.log('🚫 Sessão não encontrada no Redis');
    return null;
  }

  console.log('📦 Sessão carregada do Redis');
  /**REMOVER */

  return {
    creds: BufferJSON.reviver(JSON.parse(credData), ''), // revive buffers
    keys: BufferJSON.reviver(JSON.parse(keyData), ''),
  };
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
