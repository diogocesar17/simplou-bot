// authRedisStorage.js
const Redis = require('ioredis');

// Conecta no Redis usando a variável de ambiente REDIS_URL
const redis = new Redis(process.env.REDIS_URL);

const AUTH_KEY_CRED = 'wa:auth:credentials';
const AUTH_KEY_KEYS = 'wa:auth:keys';

async function saveAuthState(creds, keys) {
  await redis.set(AUTH_KEY_CRED, JSON.stringify(creds));
  await redis.set(AUTH_KEY_KEYS, JSON.stringify(keys));
}

async function loadAuthState() {
  const credData = await redis.get(AUTH_KEY_CRED);
  const keyData = await redis.get(AUTH_KEY_KEYS);

  if (!credData || !keyData) return null;

  return {
    creds: JSON.parse(credData),
    keys: JSON.parse(keyData),
  };
}

module.exports = {
  saveAuthState,
  loadAuthState,
};
