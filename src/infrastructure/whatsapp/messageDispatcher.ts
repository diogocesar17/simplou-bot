import { IWhatsAppAdapter } from './IWhatsAppAdapter'
import { handleMessage } from '../../index'
import { isPremium, MSG_UPGRADE } from '../../services/planoService'
import { definirEstado } from '../../configs/stateManager'
import { logger } from '../logger'
import { verificarLimiteGeminiDia, incrementarGeminiDia } from '../../services/rateLimitService'
import { montarCardConfirmacaoIA, MSG_REENVIAR_SEM_VALOR } from '../../utils/cardConfirmacaoIA'

const geminiService = require('../../services/geminiService')

const MAX_MEDIA_BYTES = 5 * 1024 * 1024 // 5 MB
const MSG_LIMITE_GEMINI = '⚠️ *Limite diário de IA atingido*\n\nVocê atingiu o limite de análises por IA hoje. Tente novamente amanhã ou envie o lançamento em texto.\n\nEx: _mercado 50 pix_'

// Ponto único de despacho de mensagens — funciona com qualquer adapter (Baileys ou Meta Cloud).
// mediaRaw: objeto de mídia já extraído pelo adapter específico (audioMessage do Baileys,
// rawMessage.audio da Meta, etc.)
export async function dispatchWhatsAppMessage(
  adapter: IWhatsAppAdapter,
  userId: string,
  texto: string,
  tipo: string,
  mediaRaw?: any,
  nomeContato?: string,
): Promise<void> {
  if (tipo === 'audio') {
    const premium = await isPremium(userId)
    if (!premium) {
      await adapter.sendMessage(userId, { text: MSG_UPGRADE })
      return
    }
    if (!(await verificarLimiteGeminiDia(userId))) {
      await adapter.sendMessage(userId, { text: MSG_LIMITE_GEMINI })
      return
    }
    try {
      await adapter.sendMessage(userId, { text: '⌛ Estou analisando sua mensagem, só um instante.' })
      const { buffer, mimeType } = await adapter.downloadAudio(mediaRaw)
      if (buffer.length > MAX_MEDIA_BYTES) {
        await adapter.sendMessage(userId, { text: '❌ Áudio muito grande (máx. 5 MB). Envie o lançamento em texto.\n\nEx: _mercado 50 pix_' })
        return
      }
      incrementarGeminiDia(userId).catch(() => {})
      const analise = await geminiService.transcreverAudioFinanceiro(buffer, mimeType, userId)

      if (!analise) {
        await adapter.sendMessage(userId, { text: MSG_REENVIAR_SEM_VALOR })
        return
      }

      // Sugestão original da IA, antes de qualquer correção do usuário — usada só para
      // instrumentação (categoria_sugerida_ia / tipo_sugerido_ia / pagamento_sugerido_ia)
      const sugestaoIA = { categoria: analise.categoria, tipo: analise.tipo, pagamento: analise.formaPagamento }
      await definirEstado(userId, 'aguardando_confirmacao_ia', { origem: 'audio', ...analise, sugestaoIA })

      // A transcrição não cabe estruturalmente no card de botões nativos (header/body/footer
      // têm papéis fixos) — enviada como mensagem de texto separada, antes do card.
      if (analise.transcricao) {
        await adapter.sendMessage(userId, { text: `_"${String(analise.transcricao).slice(0, 300)}"_` })
      }

      const card = montarCardConfirmacaoIA({
        tipo: analise.tipo,
        valor: analise.valor,
        descricao: analise.descricao,
        categoria: analise.categoria,
        data: analise.data,
      })
      await adapter.sendInteractiveMessage(userId, card)
    } catch (err) {
      logger.error({ err: (err as any)?.message || err }, '[AUDIO] Erro ao processar áudio')
      await adapter.sendMessage(userId, {
        text: '⚠️ Ocorreu um erro ao ler o áudio. Tente novamente mais tarde ou envie em texto.',
      })
    }
    return
  }

  if (tipo === 'image' || tipo === 'document') {
    const premium = await isPremium(userId)
    if (!premium) {
      await adapter.sendMessage(userId, { text: MSG_UPGRADE })
      return
    }
    if (!(await verificarLimiteGeminiDia(userId))) {
      await adapter.sendMessage(userId, { text: MSG_LIMITE_GEMINI })
      return
    }
    try {
      await adapter.sendMessage(userId, { text: '⌛ Estou analisando sua mensagem, só um instante.' })
      const { buffer, mimeType } =
        tipo === 'image'
          ? await adapter.downloadImage(mediaRaw)
          : await adapter.downloadDocument(mediaRaw)
      if (buffer.length > MAX_MEDIA_BYTES) {
        await adapter.sendMessage(userId, { text: '❌ Arquivo muito grande (máx. 5 MB). Envie o lançamento em texto.\n\nEx: _mercado 50 pix_' })
        return
      }
      incrementarGeminiDia(userId).catch(() => {})
      const analise = await geminiService.analisarVoucherFinanceiro(buffer, mimeType, userId)

      if (!analise) {
        await adapter.sendMessage(userId, { text: MSG_REENVIAR_SEM_VALOR })
        return
      }

      // Sugestão original da IA, antes de qualquer correção do usuário — usada só para
      // instrumentação (categoria_sugerida_ia / tipo_sugerido_ia / pagamento_sugerido_ia)
      const sugestaoIA = { categoria: analise.categoria, tipo: analise.tipo, pagamento: analise.formaPagamento }
      await definirEstado(userId, 'aguardando_confirmacao_ia', { origem: 'voucher', ...analise, sugestaoIA })

      const card = montarCardConfirmacaoIA({
        tipo: analise.tipo,
        valor: analise.valor,
        descricao: analise.descricao,
        categoria: analise.categoria,
        data: analise.data,
        linhasExtras: analise.parcelado ? [`Parcelado: Sim (${analise.parcelas}x)`] : undefined,
      })
      await adapter.sendInteractiveMessage(userId, card)
    } catch (err) {
      logger.error({ err: (err as any)?.message || err }, '[VOUCHER] Erro ao processar comprovante')
      await adapter.sendMessage(userId, {
        text: '⚠️ Ocorreu um erro ao ler o comprovante. Tente novamente mais tarde ou envie em texto.',
      })
    }
    return
  }

  if (texto) {
    await handleMessage(adapter, userId, texto, nomeContato)
  }
}
