import { initializeDatabase } from './infrastructure/databaseService'
import { startHealthServer } from './infrastructure/healthServer'
import { MetaCloudAdapter } from './infrastructure/whatsapp/MetaCloudAdapter'
import { logger } from './infrastructure/logger'
import { iniciarBackupScheduler } from './infrastructure/backupScheduler'
const geminiService = require('./services/geminiService')

import {
  verificarEEnviarAlertasAutomaticos,
  estaNoHorarioAlertas,
  ePrimeiraVerificacaoDoDia,
  eVerificacaoFinalDoDia,
} from './services/alertasService'

let alertasIniciados = false
let alertasIntervalId: NodeJS.Timeout | null = null

function iniciarSistemaAlertas(): void {
  if (alertasIniciados) {
    logger.info('[ALERTAS] Sistema já iniciado — ignorando nova configuração de timers')
    return
  }

  alertasIniciados = true
  logger.info('[ALERTAS] Sistema de alertas automáticos iniciado (intervalo: 60 min)')

  const adapter = new MetaCloudAdapter()

  alertasIntervalId = setInterval(async () => {
    if (!estaNoHorarioAlertas()) return

    const hora = new Date().getHours()

    if (ePrimeiraVerificacaoDoDia()) {
      logger.info({ hora }, '[ALERTAS] Primeira verificação do dia')
      await verificarEEnviarAlertasAutomaticos(adapter, false)
    } else if (eVerificacaoFinalDoDia()) {
      logger.info({ hora }, '[ALERTAS] Verificação final do dia (lembrete)')
      await verificarEEnviarAlertasAutomaticos(adapter, true)
    } else {
      logger.info({ hora }, '[ALERTAS] Verificação intermediária')
      await verificarEEnviarAlertasAutomaticos(adapter, false)
    }
  }, 60 * 60 * 1000)

  if (estaNoHorarioAlertas()) {
    logger.info('[ALERTAS] Verificação inicial imediata')
    verificarEEnviarAlertasAutomaticos(adapter, false)
  }
}

export function resetSistemaAlertas(): void {
  if (alertasIntervalId) {
    clearInterval(alertasIntervalId)
    alertasIntervalId = null
  }
  alertasIniciados = false
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
  iniciarSistemaAlertas()
  iniciarBackupScheduler()
}
