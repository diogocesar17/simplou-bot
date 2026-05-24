import { IWhatsAppAdapter } from './IWhatsAppAdapter'
import { handleMessage } from '../../index'
import { isPremium, MSG_UPGRADE } from '../../services/planoService'
import { definirEstado } from '../../configs/stateManager'
import { formatarValor } from '../../utils/formatUtils'
import { logger } from '../logger'

const geminiService = require('../../services/geminiService')

// Ponto único de despacho de mensagens — funciona com qualquer adapter (Baileys ou Meta Cloud).
// mediaRaw: objeto de mídia já extraído pelo adapter específico (audioMessage do Baileys,
// rawMessage.audio da Meta, etc.)
export async function dispatchWhatsAppMessage(
  adapter: IWhatsAppAdapter,
  userId: string,
  texto: string,
  tipo: string,
  mediaRaw?: any,
): Promise<void> {
  if (tipo === 'audio') {
    const premium = await isPremium(userId)
    if (!premium) {
      await adapter.sendMessage(userId, { text: MSG_UPGRADE })
      return
    }
    try {
      await adapter.sendMessage(userId, { text: '⌛ Estou analisando sua mensagem, só um instante.' })
      const { buffer, mimeType } = await adapter.downloadAudio(mediaRaw)
      const analise = await geminiService.transcreverAudioFinanceiro(buffer, mimeType, userId)

      if (!analise) {
        await adapter.sendMessage(userId, {
          text: '❌ Não consegui entender o áudio. Você pode enviar o lançamento em texto? Ex.: "mercado 50 pix"',
        })
        return
      }

      await definirEstado(userId, 'aguardando_confirmacao_ia', { origem: 'audio', ...analise })

      const valorFmt = formatarValor(analise.valor)
      const transcricao = String(analise.transcricao || '').slice(0, 400)
      await adapter.sendMessage(userId, {
        text:
          `🗣️ Transcrição:\n${transcricao}\n\n` +
          `🤖 Interpretação:\n` +
          `📅 Data: ${analise.data}\n` +
          `💰 Valor: R$ ${valorFmt}\n` +
          `📂 Categoria: ${analise.categoria}\n` +
          `💳 Pagamento: ${analise.formaPagamento}\n` +
          `📝 Descrição: ${analise.descricao}\n\n` +
          `✅ Confirmar lançamento? Responda com "S" para salvar ou "N" para cancelar.`,
      })
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
    try {
      await adapter.sendMessage(userId, { text: '⌛ Estou analisando sua mensagem, só um instante.' })
      const { buffer, mimeType } =
        tipo === 'image'
          ? await adapter.downloadImage(mediaRaw)
          : await adapter.downloadDocument(mediaRaw)
      const analise = await geminiService.analisarVoucherFinanceiro(buffer, mimeType, userId)

      if (!analise) {
        await adapter.sendMessage(userId, {
          text: '❌ Não consegui interpretar o comprovante. Você pode enviar o lançamento em texto? Ex.: "mercado 50 pix"',
        })
        return
      }

      await definirEstado(userId, 'aguardando_confirmacao_ia', { origem: 'voucher', ...analise })

      const valorFmt = formatarValor(analise.valor)
      const parcelado = analise.parcelado ? `\n🔢 Parcelado: Sim (${analise.parcelas}x)` : ''
      await adapter.sendMessage(userId, {
        text:
          `🤖 Análise do comprovante:\n\n` +
          `📅 Data: ${analise.data}\n` +
          `💰 Valor: R$ ${valorFmt}\n` +
          `📂 Categoria: ${analise.categoria}\n` +
          `💳 Pagamento: ${analise.formaPagamento}\n` +
          `📝 Descrição: ${analise.descricao}` +
          parcelado +
          `\n\n✅ Confirmar lançamento? Responda com "S" para confirmar ou "N" para cancelar.`,
      })
    } catch (err) {
      logger.error({ err: (err as any)?.message || err }, '[VOUCHER] Erro ao processar comprovante')
      await adapter.sendMessage(userId, {
        text: '⚠️ Ocorreu um erro ao ler o comprovante. Tente novamente mais tarde ou envie em texto.',
      })
    }
    return
  }

  if (texto) {
    await handleMessage(adapter, userId, texto)
  }
}
