const makeWASocket = require('@whiskeysockets/baileys').default;
const { parseMessage } = require('./messageParser');
const { appendRowToSheet } = require('./googleSheetService');
const { loadAuthState, saveAuthState } = require('./authRedisStorage');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

async function startBot() {
  let authState = await loadAuthState();

  const sock = makeWASocket({
    auth: authState || {},
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log('[QR Code]');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      console.log('🛑 Conexão fechada:', lastDisconnect?.error?.message);
      startBot(); // reconectar
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
    }
  });

  sock.ev.on('creds.update', async () => {
    await saveAuthState(sock.authState.creds, sock.authState.keys);
    console.log('🔐 Sessão salva no Redis');
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || !msg.message.conversation) return;

    const texto = msg.message.conversation;
    const parsed = parseMessage(texto);

    if (parsed.valor) {
      await appendRowToSheet([
        parsed.data,
        parsed.tipo,
        parsed.descricao,
        parsed.valor,
        parsed.categoria,
        parsed.pagamento,
      ]);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `✅ ${parsed.tipo} de R$ ${parsed.valor.toFixed(2)} salvo com sucesso!\n📂 Categoria: ${parsed.categoria}\n💳 Pagamento: ${parsed.pagamento}`,
      });
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Não consegui entender o valor. Tente algo como:\n\n"gastei 45 reais no mercado com débito"',
      });
    }
  });
}

startBot();
