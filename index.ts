import 'dotenv/config';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './src/index';
// Usar require para compatibilidade com CommonJS no serviço Gemini
// eslint-disable-next-line @typescript-eslint/no-var-requires
const geminiService = require('./src/services/geminiService');
import { 
  verificarEEnviarAlertasAutomaticos, 
  estaNoHorarioAlertas,
  ePrimeiraVerificacaoDoDia,
  eVerificacaoFinalDoDia
} from './src/services/alertasService';
import { initializeDatabase } from './databaseService';

async function startBot(): Promise<void> {
    // Inicializar Gemini (se GEMINI_API_KEY estiver setada)
    try {
      const ok = geminiService.initializeGemini();
      if (!ok) {
        console.log('[INIT] Gemini não inicializado (verifique GEMINI_API_KEY)');
      }
    } catch (e) {
      console.error('[INIT] Erro ao inicializar Gemini:', (e as any)?.message || e);
    }

    // Inicializar banco de dados
    try {
      console.log('🔌 Inicializando banco de dados...');
      await initializeDatabase();
      console.log('✅ Banco de dados inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar banco de dados:', error);
      process.exit(1);
    }

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
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexão encerrada:', lastDisconnect?.error?.message, '| Reconectar?', shouldReconnect);
      if (shouldReconnect) {
        startBot(); // reconecta
      } else {
        console.log('❌ Sessão encerrada. É necessário escanear o QR code novamente.');
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado com sucesso ao WhatsApp!');
      
      // Iniciar sistema de alertas automáticos
      iniciarSistemaAlertas(sock);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || !msg.message.conversation) return;
    const texto = msg.message.conversation.trim();
    const userId = msg.key.remoteJid;
    if (!userId) return;

    console.log('🔔 Mensagem recebida:', texto);
    // Delegar para o roteador modularizado
    await handleMessage(sock, userId, texto);
  });
}

/**
 * Inicia o sistema de alertas automáticos
 * @param sock - Socket do WhatsApp
 */
function iniciarSistemaAlertas(sock: any): void {
  console.log('🔔 Sistema de alertas automáticos iniciado');
  
  // Verificar alertas a cada hora (8h, 9h, 10h, 11h)
  setInterval(async () => {
    if (estaNoHorarioAlertas()) {
      const agora = new Date();
      const hora = agora.getHours();
      
      console.log(`⏰ Verificando alertas automáticos às ${hora}h...`);
      
      // Se for 8h, é a primeira verificação do dia
      if (ePrimeiraVerificacaoDoDia()) {
        console.log('🌅 Primeira verificação do dia - enviando todos os alertas');
        await verificarEEnviarAlertasAutomaticos(sock, false);
      }
      // Se for 11h, é a última verificação do dia
      else if (eVerificacaoFinalDoDia()) {
        console.log('🌆 Última verificação do dia - enviando lembretes finais');
        await verificarEEnviarAlertasAutomaticos(sock, true);
      }
      // Outras horas (9h, 10h) - verificação normal
      else {
        console.log('📋 Verificação intermediária - enviando novos alertas');
        await verificarEEnviarAlertasAutomaticos(sock, false);
      }
    }
  }, 60 * 60 * 1000); // 1 hora
  
  // Verificar alertas imediatamente se estiver no horário
  if (estaNoHorarioAlertas()) {
    console.log('🚀 Verificação inicial de alertas...');
    setTimeout(async () => {
      await verificarEEnviarAlertasAutomaticos(sock);
    }, 5000); // Aguardar 5 segundos após conexão
  }
}

startBot(); 