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
import { startHealthServer } from './src/healthServer'

let sock: WASocket | null = null
let reconnecting = false
const INITIAL_RETRY_DELAY_MS = 5000
const MAX_RETRY_DELAY_MS = 60000
let retryDelayMs = INITIAL_RETRY_DELAY_MS

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

      // Resetar controle de backoff ao conectar
      retryDelayMs = INITIAL_RETRY_DELAY_MS
      reconnecting = false

      // Iniciar sistema de alertas automáticos (uma vez por socket)
      iniciarSistemaAlertas(sock!)
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error as Boom | Error | undefined
      const statusCode = (error as Boom | undefined)?.output?.statusCode

      console.log('⚠️ Conexão encerrada.')
      console.log('   Mensagem:', (error as Error | undefined)?.message)
      console.log('   StatusCode:', statusCode)

      const reason = statusCode as number | undefined

      // Tratamento específico por statusCode / DisconnectReason
      if (reason === DisconnectReason.badSession || reason === 401) {
        // 401 / badSession: sessão inválida/expirada. Não tentar reconectar em loop.
        console.error('🛑 Sessão inválida ou expirada (401/badSession).')
        console.error('   Apague a pasta ./auth e pareie novamente para continuar.')
        return
      }

      if (reason === DisconnectReason.connectionReplaced || reason === 409) {
        // 409: conexão substituída por outro dispositivo. Evitar reconexão imediata.
        console.warn('🔄 Conexão substituída por outro dispositivo (409/connectionReplaced).')
        console.warn('   Se este não foi você, desconecte o outro dispositivo ou pareie novamente.')
        return
      }

      if (
        reason === DisconnectReason.restartRequired ||
        reason === DisconnectReason.timedOut ||
        reason === 515
      ) {
        // 515 / restartRequired / timedOut: desconexão temporária, tentar reconectar com backoff.
        console.log('♻️ Desconexão temporária (515/restartRequired/timedOut). Tentando reconectar com backoff...')
        await reconnect()
        return
      }

      if (reason === DisconnectReason.loggedOut) {
        // loggedOut: sessão realmente encerrada, requer novo pareamento.
        console.error('🚪 Sessão encerrada pelo WhatsApp (loggedOut).')
        console.error('   É necessário apagar ./auth e parear novamente.')
        return
      }

      // Default: tratar como desconexão genérica e tentar reconectar com backoff
      console.warn('⚠️ Desconexão genérica. Tentando reconectar com backoff...')
      await reconnect()
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
    const waitSeconds = Math.round(retryDelayMs / 1000)
    console.log(`⏲️ Aguardando ${waitSeconds}s antes de tentar reconectar...`)
    await new Promise((res) => setTimeout(res, retryDelayMs))

    await createSocket()
    console.log('🔌 Reconexão bem-sucedida!')
    retryDelayMs = INITIAL_RETRY_DELAY_MS
  } catch (e) {
    console.error('❌ Erro ao tentar reconectar:', (e as any)?.message || e)
    // Backoff progressivo até o máximo definido
    retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS)
    const nextSeconds = Math.round(retryDelayMs / 1000)
    console.warn(`⏳ Ajustando backoff: próxima tentativa em ~${nextSeconds}s (máx ${Math.round(MAX_RETRY_DELAY_MS/1000)}s)`)    
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
    // Fail-fast: se o banco falhar na inicialização, encerramos o processo
    // para que o Docker/Compose (com restart: always) reinicie o container
    const err = error as any
    const stack = (err?.stack || (typeof err === 'object' ? JSON.stringify(err) : String(err)))
    console.error('❌ Erro ao inicializar banco de dados:', stack)
    process.exit(1)
  }

  // Iniciar health server HTTP (porta padrão 3000 ou process.env.PORT)
  startHealthServer()

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
  const err = e as any
  const stack = (err?.stack || (typeof err === 'object' ? JSON.stringify(err) : String(err)))
  console.error('❌ Erro fatal ao iniciar aplicação:', stack)
  process.exit(1)
})
