"use strict";
// @ts-nocheck
const Redis = require('ioredis');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const redis = new Redis(process.env.REDIS_URL);
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
    }
    catch (err) {
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
    }
    catch (err) {
        console.error('❌ Erro ao carregar do Redis:', err.message);
        return null;
    }
}
async function getHybridAuthState() {
    const redisState = await loadAuthState();
    if (!redisState) {
        console.log('📌 Sessão não encontrada. Usando MultiFile.');
        const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        return {
            state,
            saveCreds: async () => {
                await saveAuthState(state.creds, state.keys);
                await saveCreds();
                console.log('✅ Sessão salva no Redis e localmente.');
            },
        };
    }
    return {
        state: redisState,
        saveCreds: async () => {
            await saveAuthState(redisState.creds, redisState.keys);
        },
    };
}
module.exports = {
    getHybridAuthState,
};
//# sourceMappingURL=authRedisStorage.js.map