import 'dotenv/config'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { handleMessage } from './src/index'
// Usar require para compatibilidade com CommonJS no serviço Gemini
// eslint-disable-next-line @typescript-eslint/no-var-requires
const geminiService = require('./src/services/geminiService')
import {
  verificarEEnviarAlertasAutomaticos,
  estaNoHorarioAlertas,
  ePrimeiraVerificacaoDoDia,
  eVerificacaoFinalDoDia,
} from './src/services/alertasService'
import { initializeDatabase } from './databaseService'
import { Boom } from '@hapi/boom'

let sock: WASocket | null = null
let reconnecting = false

/**
 * Cria o socket do WhatsApp e registra os listeners.
 * NÃO reinicializa banco nem Gemini.
 */
async function createSocket(): Promise<void> {
  // Persistência local de sessão WhatsApp (pasta "auth")
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    auth: state,
    version,
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
    // ❌ NÃO usar mais printQRInTerminal (deprecado)
    // printQRInTerminal: true,
  })

  // Pareamento alternativo por código, se não houver sessão registrada
  if (!state.creds?.registered && process.env.WHATSAPP_PAIRING_NUMBER) {
    try {
      const code = await sock.requestPairingCode(process.env.WHATSAPP_PAIRING_NUMBER)
      console.log(`🔗 Código de pareamento: ${code}\n👉 No celular: WhatsApp > Aparelhos conectados > Conectar com código`)
    } catch (err) {
      console.error('❌ Erro ao solicitar código de pareamento:', (err as any)?.message || err)
    }
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('📲 Escaneie o QR Code abaixo:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ Conectado com sucesso ao WhatsApp!')

      // Iniciar sistema de alertas automáticos (uma vez por socket)
      iniciarSistemaAlertas(sock!)
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error as Boom | Error | undefined
      const statusCode = (error as Boom | undefined)?.output?.statusCode

      console.log('⚠️ Conexão encerrada.')
      console.log('   Mensagem:', (error as Error | undefined)?.message)
      console.log('   StatusCode:', statusCode)

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log('🔁 Tentando reconectar ao WhatsApp...')
        await reconnect()
      } else {
        console.log('❌ Sessão encerrada pelo WhatsApp (loggedOut).')
        console.log('   Apague a pasta ./auth para parear novamente.')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    console.log('📥 Mensagem recebida:', msg);
    // Extrai texto de diferentes tipos de mensagem suportados pelo Baileys
    const raw: any = msg?.message
    const texto: string = (raw?.conversation
      || raw?.extendedTextMessage?.text
      || raw?.imageMessage?.caption
      || raw?.videoMessage?.caption
      || raw?.buttonsResponseMessage?.selectedButtonId
      || raw?.listResponseMessage?.title
      || '').trim()
    if (!texto) {
      console.log('[MSG] Mensagem sem texto legível, ignorando. Tipos:', Object.keys(raw || {}))
      return
    }
    const userId = msg.key.remoteJid
    if (!userId) return

    // Filtro para seu número específico
    // if (userId !== '556181429135@s.whatsapp.net') return

    console.log('🔔 Mensagem recebida:', texto)

    await handleMessage(sock!, userId, texto)
  })
}

/**
 * Lógica de reconexão: só recria o socket,
 * não reinicializa banco, Gemini, etc.
 */
async function reconnect(): Promise<void> {
  if (reconnecting) {
    console.log('⏳ Já existe uma tentativa de reconexão em andamento, ignorando...')
    return
  }

  reconnecting = true
  try {
    await createSocket()
  } catch (e) {
    console.error('❌ Erro ao tentar reconectar:', (e as any)?.message || e)
  } finally {
    reconnecting = false
  }
}

/**
 * Inicializa o app uma única vez:
 * - Gemini
 * - Banco de dados
 * - Socket WhatsApp
 */
async function initApp(): Promise<void> {
  // Inicializar Gemini (se GEMINI_API_KEY estiver setada)
  try {
    const ok = geminiService.initializeGemini()
    if (!ok) {
      console.log('[INIT] Gemini não inicializado (verifique GEMINI_API_KEY)')
    }
  } catch (e) {
    console.error('[INIT] Erro ao inicializar Gemini:', (e as any)?.message || e)
  }

  // Inicializar banco de dados (uma vez só)
  try {
    console.log('🔌 Inicializando banco de dados...')
    await initializeDatabase()
    console.log('✅ Banco de dados inicializado com sucesso!')
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error)
    process.exit(1)
  }

  await createSocket()
}

/**
 * Inicia o sistema de alertas automáticos.
 * @param sock - Socket do WhatsApp
 */
function iniciarSistemaAlertas(sock: WASocket): void {
  console.log('🔔 Sistema de alertas automáticos iniciado')

  // Verificar alertas a cada hora (8h, 9h, 10h, 11h)
  setInterval(async () => {
    if (estaNoHorarioAlertas()) {
      const agora = new Date()
      const hora = agora.getHours()

      console.log(`⏰ Verificando alertas automáticos às ${hora}h...`)

      if (ePrimeiraVerificacaoDoDia()) {
        console.log('🌅 Primeira verificação do dia - enviando todos os alertas')
        await verificarEEnviarAlertasAutomaticos(sock, false)
      } else if (eVerificacaoFinalDoDia()) {
        console.log('🌆 Última verificação do dia - enviando lembretes finais')
        await verificarEEnviarAlertasAutomaticos(sock, true)
      } else {
        console.log('📋 Verificação intermediária - enviando novos alertas')
        await verificarEEnviarAlertasAutomaticos(sock, false)
      }
    }
  }, 60 * 60 * 1000) // 1 hora

  // Verificar alertas imediatamente se estiver no horário
  if (estaNoHorarioAlertas()) {
    console.log('🚀 Verificação inicial de alertas...')
    setTimeout(async () => {
      await verificarEEnviarAlertasAutomaticos(sock)
    }, 5000)
  }
}

// 🚀 Start da aplicação
initApp().catch((e) => {
  console.error('❌ Erro fatal ao iniciar aplicação:', e)
  process.exit(1)
})
