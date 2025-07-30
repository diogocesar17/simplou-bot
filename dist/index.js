"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const index_1 = require("./src/index");
const alertasService_1 = require("./src/services/alertasService");
async function startBot() {
    // Persistência local de sessão WhatsApp
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)('auth');
    const sock = (0, baileys_1.default)({
        auth: state,
        printQRInTerminal: false,
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('📲 Escaneie o QR Code abaixo:');
            qrcode_terminal_1.default.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log('⚠️ Conexão encerrada:', lastDisconnect?.error?.message, '| Reconectar?', shouldReconnect);
            if (shouldReconnect) {
                startBot(); // reconecta
            }
            else {
                console.log('❌ Sessão encerrada. É necessário escanear o QR code novamente.');
            }
        }
        else if (connection === 'open') {
            console.log('✅ Conectado com sucesso ao WhatsApp!');
            // Iniciar sistema de alertas automáticos
            iniciarSistemaAlertas(sock);
        }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify')
            return;
        const msg = messages[0];
        if (!msg.message || !msg.message.conversation)
            return;
        const texto = msg.message.conversation.trim();
        const userId = msg.key.remoteJid;
        if (!userId)
            return;
        if (userId !== '556181429135@s.whatsapp.net')
            return;
        console.log('🔔 Mensagem recebida:', texto);
        // Delegar para o roteador modularizado
        await (0, index_1.handleMessage)(sock, userId, texto);
    });
}
/**
 * Inicia o sistema de alertas automáticos
 * @param sock - Socket do WhatsApp
 */
function iniciarSistemaAlertas(sock) {
    console.log('🔔 Sistema de alertas automáticos iniciado');
    // Verificar alertas a cada hora (8h, 9h, 10h, 11h)
    setInterval(async () => {
        if ((0, alertasService_1.estaNoHorarioAlertas)()) {
            const agora = new Date();
            const hora = agora.getHours();
            console.log(`⏰ Verificando alertas automáticos às ${hora}h...`);
            // Se for 8h, é a primeira verificação do dia
            if ((0, alertasService_1.ePrimeiraVerificacaoDoDia)()) {
                console.log('🌅 Primeira verificação do dia - enviando todos os alertas');
                await (0, alertasService_1.verificarEEnviarAlertasAutomaticos)(sock, false);
            }
            // Se for 11h, é a última verificação do dia
            else if ((0, alertasService_1.eVerificacaoFinalDoDia)()) {
                console.log('🌆 Última verificação do dia - enviando lembretes finais');
                await (0, alertasService_1.verificarEEnviarAlertasAutomaticos)(sock, true);
            }
            // Outras horas (9h, 10h) - verificação normal
            else {
                console.log('📋 Verificação intermediária - enviando novos alertas');
                await (0, alertasService_1.verificarEEnviarAlertasAutomaticos)(sock, false);
            }
        }
    }, 60 * 60 * 1000); // 1 hora
    // Verificar alertas imediatamente se estiver no horário
    if ((0, alertasService_1.estaNoHorarioAlertas)()) {
        console.log('🚀 Verificação inicial de alertas...');
        setTimeout(async () => {
            await (0, alertasService_1.verificarEEnviarAlertasAutomaticos)(sock);
        }, 5000); // Aguardar 5 segundos após conexão
    }
}
startBot();
//# sourceMappingURL=index.js.map