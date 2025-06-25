const Redis = require('ioredis');
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

const redis = new Redis(process.env.REDIS_URL);

const AUTH_KEY_CRED = 'wa:auth:credentials';
const AUTH_KEY_KEYS = 'wa:auth:keys';

async function saveAuthState(creds, keys) {
  await redis.set(AUTH_KEY_CRED, JSON.stringify(BufferJSON.replacer(creds)));
  await redis.set(AUTH_KEY_KEYS, JSON.stringify(BufferJSON.replacer(keys)));
}

async function loadAuthState() {
  const credData = await redis.get(AUTH_KEY_CRED);
  const keyData = await redis.get(AUTH_KEY_KEYS);

  if (!credData || !keyData) return null;

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
