require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./src/index');

async function startBot() {
  // Persistência local de sessão WhatsApp
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('📲 Escaneie o QR Code abaixo:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexão encerrada:', lastDisconnect?.error?.message, '| Reconectar?', shouldReconnect);
      if (shouldReconnect) {
        startBot(); // reconecta
      } else {
        console.log('❌ Sessão encerrada. É necessário escanear o QR code novamente.');
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado com sucesso ao WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || !msg.message.conversation) return;
    const texto = msg.message.conversation.trim();
    const userId = msg.key.remoteJid;
    // Delegar para o roteador modularizado
    await handleMessage(sock, userId, texto);
  });
}

startBot();