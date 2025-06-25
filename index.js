const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { parseMessage } = require('./messageParser');
const { appendRowToSheet } = require('./googleSheetService');
require('dotenv').config();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);

  // 🔹 Exibir QR Code se necessário
  sock.ev.on('connection.update', (update) => {
    const { qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
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
