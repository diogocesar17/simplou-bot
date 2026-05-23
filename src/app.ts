import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  WAMessage,
  MessageUpsertType,
} from '@whiskeysockets/baileys'
import { BaileysAdapter } from './infrastructure/whatsapp/BaileysAdapter'
import { dispatchWhatsAppMessage } from './infrastructure/whatsapp/messageDispatcher'
import qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'

import { initializeDatabase } from './infrastructure/databaseService'
import { startHealthServer } from './infrastructure/healthServer'
import { getHybridAuthState } from './infrastructure/auth/authRedisStorage'
import { logger, debug } from './infrastructure/logger'
const geminiService = require('./services/geminiService')

import {
  verificarEEnviarAlertasAutomaticos,
  estaNoHorarioAlertas,
  ePrimeiraVerificacaoDoDia,
  eVerificacaoFinalDoDia,
} from './services/alertasService'
import { isPremium, MSG_UPGRADE } from './services/planoService'

let sock: WASocket | null = null
let reconnecting = false
const INITIAL_RETRY_DELAY_MS = 5000
const MAX_RETRY_DELAY_MS = 60000
let retryDelayMs = INITIAL_RETRY_DELAY_MS
let alertasIniciados = false
let alertasIntervalId: NodeJS.Timeout | null = null
let sockRef: WASocket | null = null

async function safeCloseSocket(reason = 'Fechando socket atual'): Promise<void> {
  if (!sock) return

  try {
    sock.ev.removeAllListeners('connection.update')
    sock.ev.removeAllListeners('messages.upsert')
    sock.ev.removeAllListeners('creds.update')
  } catch (e) {
    logger.warn({ err: (e as any)?.message || e }, '[WA] Erro ao remover listeners do socket')
  }

  try {
    sock.end(new Error(reason))
  } catch (e) {
    logger.warn({ err: (e as any)?.message || e }, '[WA] Erro ao encerrar socket')
  }

  sock = null
}

async function createSocket(): Promise<void> {
  await safeCloseSocket('Criando novo socket')

  const { state, saveCreds } = await getHybridAuthState()
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    auth: state,
    version,
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
    connectTimeoutMs: 120_000,
    defaultQueryTimeoutMs: 120_000,
    keepAliveIntervalMs: 20_000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  })

  if (!state.creds?.registered && process.env.WHATSAPP_PAIRING_NUMBER) {
    try {
      const code = await sock.requestPairingCode(process.env.WHATSAPP_PAIRING_NUMBER)
      logger.info({ code }, '[WA] Código de pareamento gerado')
      console.log(`🔗 Código de pareamento: ${code}\n👉 No celular: WhatsApp > Aparelhos conectados > Conectar com código`)
    } catch (err) {
      logger.error({ err: (err as any)?.message || err }, '[WA] Erro ao solicitar código de pareamento')
    }
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('📲 Escaneie o QR Code abaixo:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      logger.info('[WA] Conectado com sucesso ao WhatsApp')
      retryDelayMs = INITIAL_RETRY_DELAY_MS
      reconnecting = false
      iniciarSistemaAlertas(sock!)
      return
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error as Boom | Error | undefined
      const statusCode = (error as Boom | undefined)?.output?.statusCode
      const errMsg = (error as Error | undefined)?.message

      logger.warn({ statusCode, err: errMsg }, '[WA] Conexão encerrada')

      if (statusCode === DisconnectReason.badSession || statusCode === 401) {
        logger.error({ statusCode }, '[WA] Sessão inválida ou expirada — requer novo pareamento')
        return
      }

      if (statusCode === DisconnectReason.connectionReplaced || statusCode === 409) {
        logger.warn({ statusCode }, '[WA] Conexão substituída por outro dispositivo')
        return
      }

      if (
        statusCode === DisconnectReason.restartRequired ||
        statusCode === DisconnectReason.timedOut ||
        statusCode === 408 ||
        statusCode === 428 ||
        statusCode === 500 ||
        statusCode === 503 ||
        statusCode === 515
      ) {
        logger.warn({ statusCode }, '[WA] Desconexão temporária — iniciando reconexão com backoff')
        await reconnect()
        return
      }

      if (statusCode === DisconnectReason.loggedOut) {
        logger.error({ statusCode }, '[WA] Sessão encerrada pelo WhatsApp (loggedOut) — requer novo pareamento')
        return
      }

      logger.warn({ statusCode }, '[WA] Desconexão genérica — iniciando reconexão com backoff')
      await reconnect()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }: { messages: WAMessage[]; type: MessageUpsertType }) => {
    if (type !== 'notify') return
    const msg: WAMessage = messages[0]
    if (!msg?.message) return
    if ((msg.message as any)?.protocolMessage) return

    const DEBUG_MESSAGES = process.env.DEBUG_MESSAGES === 'true'

    const raw = msg?.message as Record<string, any> | undefined
    const userId = msg.key.remoteJid
    if (!userId) return

    const tipo = (raw as any)?.audioMessage ? 'audio'
      : (raw as any)?.imageMessage ? 'image'
      : (raw as any)?.documentMessage ? 'document'
      : 'text'

    const texto: string = (
      raw?.conversation ??
      raw?.extendedTextMessage?.text ??
      raw?.imageMessage?.caption ??
      raw?.videoMessage?.caption ??
      raw?.documentMessage?.caption ??
      raw?.buttonsResponseMessage?.selectedButtonId ??
      raw?.listResponseMessage?.title ??
      ''
    ).trim()

    logger.info({ userId, tipo, trecho: texto.slice(0, 100) }, 'Mensagem recebida')

    if (DEBUG_MESSAGES && process.env.NODE_ENV !== 'production') {
      debug('Mensagem recebida (detalhe controlado)', {
        userId,
        keys: Object.keys(raw || {}),
        hasQuoted: Boolean((raw as any)?.extendedTextMessage?.contextInfo?.quotedMessage),
      })
    }

    const mediaRaw = (raw as any)?.audioMessage ?? (raw as any)?.imageMessage ?? (raw as any)?.documentMessage
    await dispatchWhatsAppMessage(new BaileysAdapter(sock!), userId, texto, tipo, mediaRaw)
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
    logger.info({ delayMs: retryDelayMs }, '[WA] Aguardando antes de reconectar')
    await new Promise((res) => setTimeout(res, retryDelayMs))

    await createSocket()
    logger.info('[WA] Reconexão bem-sucedida')
    retryDelayMs = INITIAL_RETRY_DELAY_MS
  } catch (e) {
    retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS)
    logger.error({ err: (e as any)?.message || e, proximoDelayMs: retryDelayMs }, '[WA] Erro ao reconectar — backoff ajustado')
  } finally {
    reconnecting = false
  }
}

function iniciarSistemaAlertas(sock: WASocket): void {
  sockRef = sock

  if (alertasIniciados) {
    logger.info('[ALERTAS] Sistema já iniciado — ignorando nova configuração de timers')
    return
  }

  alertasIniciados = true
  logger.info('[ALERTAS] Sistema de alertas automáticos iniciado (intervalo: 60 min)')

  alertasIntervalId = setInterval(async () => {
    if (estaNoHorarioAlertas()) {
      const hora = new Date().getHours()

      const s = sockRef
      if (!s) {
        logger.warn('[ALERTAS] Socket ausente ao verificar alertas — aguardando reconexão')
        return
      }

      if (ePrimeiraVerificacaoDoDia()) {
        logger.info({ hora }, '[ALERTAS] Primeira verificação do dia')
        await verificarEEnviarAlertasAutomaticos(s, false)
      } else if (eVerificacaoFinalDoDia()) {
        logger.info({ hora }, '[ALERTAS] Verificação final do dia (lembrete)')
        await verificarEEnviarAlertasAutomaticos(s, true)
      } else {
        logger.info({ hora }, '[ALERTAS] Verificação intermediária')
        await verificarEEnviarAlertasAutomaticos(s, false)
      }
    }
  }, 60 * 60 * 1000)

  if (estaNoHorarioAlertas()) {
    logger.info('[ALERTAS] Verificação inicial imediata')
    verificarEEnviarAlertasAutomaticos(sockRef!, false)
  }
}

export function resetSistemaAlertas(): void {
  if (alertasIntervalId) {
    clearInterval(alertasIntervalId)
    alertasIntervalId = null
  }
  alertasIniciados = false
  sockRef = null
  logger.info('[ALERTAS] Sistema resetado — timers limpos')
}

export async function bootstrap(): Promise<void> {
  try {
    const ok = geminiService.initializeGemini()
    if (!ok) {
      logger.warn('[INIT] Gemini não inicializado — verifique GEMINI_API_KEY')
    }
  } catch (e) {
    logger.error({ err: (e as any)?.message || e }, '[INIT] Erro ao inicializar Gemini')
  }

  try {
    logger.info('[INIT] Inicializando banco de dados')
    await initializeDatabase()
    logger.info('[INIT] Banco de dados inicializado com sucesso')
  } catch (error) {
    const err = error as any
    const stack = err?.stack || (typeof err === 'object' ? JSON.stringify(err) : String(err))
    logger.error({ err: stack }, '[INIT] Falha crítica ao inicializar banco de dados')
    process.exit(1)
  }

  startHealthServer()
  await createSocket()
}