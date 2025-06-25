require('dotenv').config();
const { default: makeWASocket, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { parseMessage } = require('./messageParser');
const { appendRowToSheet } = require('./googleSheetService');
const { getHybridAuthState } = require('./authRedisStorage');


async function startBot() {
  const { state, saveCreds } = await getHybridAuthState();

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // desativado, usamos evento manual
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('📲 Escaneie o QR Code com o WhatsApp neste link:');
      console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp');
    }

    if (connection === 'close') {
      console.log('⚠️ Conexão encerrada:', lastDisconnect?.error?.message);
    }
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
        text: `✅ ${parsed.tipo} de R$ ${parsed.valor.toFixed(2)} salvo com sucesso!\n📂 Categoria: ${parsed.categoria}\n💳 Pagamento: ${parsed.pagamento}`
      });
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Não consegui entender o valor. Tente algo como:\n\n"gastei 45 reais no mercado com débito"'
      });
    }
  });
}

startBot();
