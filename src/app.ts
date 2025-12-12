import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  WAMessage,
  MessageUpsertType,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'

import { initializeDatabase } from './infrastructure/databaseService'
import { startHealthServer } from './infrastructure/healthServer'
import { handleMessage } from './index'
import { getHybridAuthState } from './infrastructure/auth/authRedisStorage'
// Usar require para compatibilidade com CommonJS no serviço Gemini
// eslint-disable-next-line @typescript-eslint/no-var-requires
const geminiService = require('./services/geminiService')

import {
  verificarEEnviarAlertasAutomaticos,
  estaNoHorarioAlertas,
  ePrimeiraVerificacaoDoDia,
  eVerificacaoFinalDoDia,
} from './services/alertasService'

let sock: WASocket | null = null
let reconnecting = false
const INITIAL_RETRY_DELAY_MS = 5000
const MAX_RETRY_DELAY_MS = 60000
let retryDelayMs = INITIAL_RETRY_DELAY_MS

async function createSocket(): Promise<void> {
  const { state, saveCreds } = await getHybridAuthState()
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    auth: state,
    version,
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
  })

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
      retryDelayMs = INITIAL_RETRY_DELAY_MS
      reconnecting = false
      iniciarSistemaAlertas(sock!)
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error as Boom | Error | undefined
      const statusCode = (error as Boom | undefined)?.output?.statusCode
      console.log('⚠️ Conexão encerrada.')
      console.log('   Mensagem:', (error as Error | undefined)?.message)
      console.log('   StatusCode:', statusCode)
      const reason = statusCode as number | undefined

      if (reason === DisconnectReason.badSession || reason === 401) {
        console.error('🛑 Sessão inválida ou expirada (401/badSession).')
        console.error('   Apague a pasta ./auth e pareie novamente para continuar.')
        return
      }

      if (reason === DisconnectReason.connectionReplaced || reason === 409) {
        console.warn('🔄 Conexão substituída por outro dispositivo (409/connectionReplaced).')
        console.warn('   Se este não foi você, desconecte o outro dispositivo ou pareie novamente.')
        return
      }

      if (
        reason === DisconnectReason.restartRequired ||
        reason === DisconnectReason.timedOut ||
        reason === 515
      ) {
        console.log('♻️ Desconexão temporária (515/restartRequired/timedOut). Tentando reconectar com backoff...')
        await reconnect()
        return
      }

      if (reason === DisconnectReason.loggedOut) {
        console.error('🚪 Sessão encerrada pelo WhatsApp (loggedOut).')
        console.error('   É necessário apagar ./auth e parear novamente.')
        return
      }

      console.warn('⚠️ Desconexão genérica. Tentando reconectar com backoff...')
      await reconnect()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }: { messages: WAMessage[]; type: MessageUpsertType }) => {
    if (type !== 'notify') return
    const msg: WAMessage = messages[0]
    console.log('📥 Mensagem recebida:', msg)

    type IncomingTextContent = {
      conversation?: string
      extendedTextMessage?: { text?: string }
      imageMessage?: { caption?: string }
      videoMessage?: { caption?: string }
      buttonsResponseMessage?: { selectedButtonId?: string }
      listResponseMessage?: { title?: string }
      [key: string]: unknown
    }

    const raw = msg?.message as IncomingTextContent | undefined
    const texto: string = (
      raw?.conversation ??
      raw?.extendedTextMessage?.text ??
      raw?.imageMessage?.caption ??
      raw?.videoMessage?.caption ??
      raw?.buttonsResponseMessage?.selectedButtonId ??
      raw?.listResponseMessage?.title ??
      ''
    ).trim()
    if (!texto) {
      console.log('[MSG] Mensagem sem texto legível, ignorando. Tipos:', Object.keys(raw || {}))
      return
    }
    const userId = msg.key.remoteJid
    if (!userId) return

    // Filtro para seu número específico
    if (userId !== '556181429135@s.whatsapp.net') return

    console.log('🔔 Mensagem recebida:', texto)
    await handleMessage(sock!, userId, texto)
  })
}

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
    retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS)
    const nextSeconds = Math.round(retryDelayMs / 1000)
    console.warn(`⏳ Ajustando backoff: próxima tentativa em ~${nextSeconds}s (máx ${Math.round(MAX_RETRY_DELAY_MS/1000)}s)`)    
  } finally {
    reconnecting = false
  }
}

function iniciarSistemaAlertas(sock: WASocket): void {
  console.log('🔔 Sistema de alertas automáticos iniciado')

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
  }, 60 * 60 * 1000)

  if (estaNoHorarioAlertas()) {
    console.log('🚀 Verificação inicial de alertas...')
    verificarEEnviarAlertasAutomaticos(sock, false)
  }
}

export async function bootstrap(): Promise<void> {
  // Gemini
  try {
    const ok = geminiService.initializeGemini()
    if (!ok) {
      console.log('[INIT] Gemini não inicializado (verifique GEMINI_API_KEY)')
    }
  } catch (e) {
    console.error('[INIT] Erro ao inicializar Gemini:', (e as any)?.message || e)
  }

  // Banco
  try {
    console.log('🔌 Inicializando banco de dados...')
    await initializeDatabase()
    console.log('✅ Banco de dados inicializado com sucesso!')
  } catch (error) {
    const err = error as any
    const stack = err?.stack || (typeof err === 'object' ? JSON.stringify(err) : String(err))
    console.error('❌ Erro ao inicializar banco de dados:', stack)
    process.exit(1)
  }

  // Health server
  startHealthServer()

  // Socket
  await createSocket()
}
