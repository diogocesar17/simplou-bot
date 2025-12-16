import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  WAMessage,
  MessageUpsertType,
  downloadContentFromMessage,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'

import { initializeDatabase } from './infrastructure/databaseService'
import { startHealthServer } from './infrastructure/healthServer'
import { handleMessage } from './index'
import { getHybridAuthState } from './infrastructure/auth/authRedisStorage'
import { logger, debug } from './infrastructure/logger'
// Usar require para compatibilidade com CommonJS no serviço Gemini
// eslint-disable-next-line @typescript-eslint/no-var-requires
const geminiService = require('./services/geminiService')
import { definirEstado } from './configs/stateManager'
import { formatarValor } from './utils/formatUtils'

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
// Controle para evitar múltiplos timers de alertas em reconexões
let alertasIniciados = false
let alertasIntervalId: NodeJS.Timeout | null = null
let sockRef: WASocket | null = null

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
    const DEBUG_MESSAGES = process.env.DEBUG_MESSAGES === 'true'

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
    const userId = msg.key.remoteJid
    if (!userId) return

    // Filtro para seu número específico
    if (userId !== '556181429135@s.whatsapp.net') return

    // Determina tipo básico da mensagem
    const tipoMensagem = raw?.conversation || raw?.extendedTextMessage?.text
      ? 'texto'
      : raw?.imageMessage
      ? 'imagem'
      : (raw as any)?.audioMessage
      ? 'audio'
      : raw?.documentMessage
      ? 'documento'
      : raw?.videoMessage
      ? 'video'
      : raw?.buttonsResponseMessage
      ? 'botao'
      : raw?.listResponseMessage
      ? 'lista'
      : 'desconhecido'

    // Log enxuto para produção
    logger.info({ userId, tipoMensagem, trecho: texto.slice(0, 100) }, 'Mensagem recebida')

    // Log detalhado opcional somente em dev e quando habilitado
    if (DEBUG_MESSAGES && process.env.NODE_ENV !== 'production') {
      debug('Mensagem recebida (detalhe controlado)', {
        userId,
        keys: Object.keys(raw || {}),
        hasQuoted: Boolean((raw as any)?.extendedTextMessage?.contextInfo?.quotedMessage),
      })
    }
    // Fluxo de áudio: prioridade sobre texto
    const hasAudio = Boolean((raw as any)?.audioMessage)
    if (hasAudio) {
      try {
        // Aviso pré-processamento de IA para áudio
        await sock!.sendMessage(userId, { text: '⌛ Estou analisando sua mensagem, só um instante.' })
        const audioMessage = (raw as any)?.audioMessage
        const stream = await downloadContentFromMessage(audioMessage, 'audio')
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer)
        }
        const fileBuffer = Buffer.concat(chunks)
        const mimeType: string = (audioMessage as any)?.mimetype || 'audio/ogg'

        const analiseAudio = await geminiService.transcreverAudioFinanceiro(fileBuffer, mimeType, userId)

        if (!analiseAudio) {
          await sock!.sendMessage(userId, {
            text: '❌ Não consegui entender o áudio. Você pode enviar o lançamento em texto? Ex.: "mercado 50 pix"',
          })
          return
        }

        await definirEstado(userId, 'aguardando_confirmacao_ia', { origem: 'audio', ...analiseAudio })

        const valorFmt = formatarValor(analiseAudio.valor)
        const transcricaoExibicao = String(analiseAudio.transcricao || '').slice(0, 400)
        const resumo = `🗣️ Transcrição:\n${transcricaoExibicao}\n\n` +
          `🤖 Interpretação:\n` +
          `📅 Data: ${analiseAudio.data}\n` +
          `💰 Valor: R$ ${valorFmt}\n` +
          `📂 Categoria: ${analiseAudio.categoria}\n` +
          `💳 Pagamento: ${analiseAudio.formaPagamento}\n` +
          `📝 Descrição: ${analiseAudio.descricao}\n\n` +
          `✅ Confirmar lançamento? Responda com "S" para salvar ou "N" para cancelar.`

        await sock!.sendMessage(userId, { text: resumo })
        return
      } catch (err) {
        logger.error({ err: (err as any)?.message || err }, '[AUDIO] Erro ao processar áudio')
        await sock!.sendMessage(userId, { text: '⚠️ Ocorreu um erro ao ler o áudio. Tente novamente mais tarde ou envie em texto.' })
        return
      }
    }

    // Fluxo de voucher: tratar imagens ou documentos como comprovantes
    const hasVoucherMedia = Boolean((raw as any)?.imageMessage || (raw as any)?.documentMessage)

    if (hasVoucherMedia) {
      try {
        // Aviso pré-processamento de IA para imagem/documento (voucher)
        await sock!.sendMessage(userId, { text: '⌛ Estou analisando sua mensagem, só um instante.' })
        const isImage = Boolean((raw as any)?.imageMessage)
        const mediaMessage = (raw as any)?.imageMessage || (raw as any)?.documentMessage
        const stream = await downloadContentFromMessage(mediaMessage, isImage ? 'image' : 'document')
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer)
        }
        const fileBuffer = Buffer.concat(chunks)
        const mimeType: string = (mediaMessage as any)?.mimetype || (isImage ? 'image/jpeg' : 'application/pdf')

        const analise = await geminiService.analisarVoucherFinanceiro(fileBuffer, mimeType, userId)

        if (!analise) {
          await sock!.sendMessage(userId, {
            text: '❌ Não consegui interpretar o comprovante. Você pode enviar o lançamento em texto? Ex.: "mercado 50 pix"',
          })
          return
        }

        // Definir estado para confirmação via IA
        await definirEstado(userId, 'aguardando_confirmacao_ia', { origem: 'voucher', ...analise })

        const valorFmt = formatarValor(analise.valor)
        const parceladoTexto = analise.parcelado ? `\n🔢 Parcelado: Sim (${analise.parcelas}x)` : '';
        const resumo = `🤖 Análise do comprovante:\n\n` +
          `📅 Data: ${analise.data}\n` +
          `💰 Valor: R$ ${valorFmt}\n` +
          `📂 Categoria: ${analise.categoria}\n` +
          `💳 Pagamento: ${analise.formaPagamento}\n` +
          `📝 Descrição: ${analise.descricao}` +
          parceladoTexto + `\n\n` +
          `✅ Confirmar lançamento? Responda com "S" para confirmar ou "N" para cancelar.`

        await sock!.sendMessage(userId, { text: resumo })
        return
      } catch (err) {
        logger.error({ err: (err as any)?.message || err }, '[VOUCHER] Erro ao processar comprovante')
        await sock!.sendMessage(userId, { text: '⚠️ Ocorreu um erro ao ler o comprovante. Tente novamente mais tarde ou envie em texto.' })
        return
      }
    }

    // Se não houver mídia de voucher, seguir fluxo normal de texto
    if (!texto) {
      const tipos = Object.keys(raw || {})
      logger.info({ tipos }, '[MSG] Mensagem sem texto legível — ignorando')
      return
    }

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
  // Atualiza referência do socket sempre, mesmo em reconexões
  sockRef = sock

  // Se já iniciado, não cria novos timers
  if (alertasIniciados) {
    console.log('🔕 Alertas já iniciados anteriormente — ignorando nova configuração de timers.')
    return
  }

  alertasIniciados = true
  console.log('🔔 Sistema de alertas automáticos iniciado')

  alertasIntervalId = setInterval(async () => {
    if (estaNoHorarioAlertas()) {
      const agora = new Date()
      const hora = agora.getHours()
      console.log(`⏰ Verificando alertas automáticos às ${hora}h...`)

      const s = sockRef
      if (!s) {
        console.warn('⚠️ Socket ausente ao verificar alertas — aguardando reconexão.')
        return
      }

      if (ePrimeiraVerificacaoDoDia()) {
        console.log('🌅 Primeira verificação do dia - enviando todos os alertas')
        await verificarEEnviarAlertasAutomaticos(s, false)
      } else if (eVerificacaoFinalDoDia()) {
        console.log('🌆 Última verificação do dia - enviando lembretes finais')
        await verificarEEnviarAlertasAutomaticos(s, true)
      } else {
        console.log('📋 Verificação intermediária - enviando novos alertas')
        await verificarEEnviarAlertasAutomaticos(s, false)
      }
    }
  }, 60 * 60 * 1000)

  if (estaNoHorarioAlertas()) {
    console.log('🚀 Verificação inicial de alertas...')
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
  console.log('🔄 Sistema de alertas resetado — timers limpos e flag reiniciada.')
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
