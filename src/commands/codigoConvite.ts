import { IWhatsAppAdapter } from '../infrastructure/whatsapp/IWhatsAppAdapter'
import { definirEstado, limparEstado } from '../configs/stateManager'
import { logger } from '../infrastructure/logger'
import * as databaseService from '../infrastructure/databaseService'

const MSG_CODIGO_INVALIDO =
  'Opa! Esse acesso é por convite 👋\n\n' +
  'Comenta QUERO no nosso TikTok (@usesimplou) que a gente te manda o código.'

// Mensagem usada apenas no fallback: usuário que chegou sem o link pré-preenchido
const MSG_SOLICITAR_CODIGO =
  'Oi! O Simplou está em beta fechado. ' +
  'Se você recebeu um código de convite, manda aqui pra eu liberar seu acesso.'

function codigoConfigurado(): string {
  return (process.env.CODIGO_CONVITE ?? '').trim().toUpperCase()
}

function textoContemCodigo(texto: string): boolean {
  const codigo = codigoConfigurado()
  if (!codigo) return true // failsafe: variável ausente não bloqueia (ambiente local)
  return texto.toUpperCase().includes(codigo)
}

/**
 * Valida se a primeira mensagem de um usuário desconhecido contém o código de convite.
 * Retorna true se o código foi encontrado — o chamador deve avançar para LGPD.
 * Retorna false se o código não foi encontrado — a resposta já foi enviada, nada deve ser persistido.
 *
 * Nada é salvo no banco nem no Redis quando o código é inválido: spam nunca é persistido.
 */
export async function validarPrimeiraMensagem(
  adapter: IWhatsAppAdapter,
  userId: string,
  texto: string,
): Promise<boolean> {
  const codigo = codigoConfigurado()

  if (!codigo) {
    logger.warn({ userId }, '[CONVITE] CODIGO_CONVITE não configurado — acesso liberado sem validação')
    return true
  }

  if (textoContemCodigo(texto)) {
    logger.info({ userId }, '[CONVITE] Código de convite aceito na primeira mensagem')
    // registrarLog só persiste o evento de aceitação — sem criar usuário ainda
    await databaseService.registrarLog(userId, 'CODIGO_CONVITE_ACEITO', null)
    return true
  }

  // Código ausente ou errado — nunca logar o código correto, apenas a tentativa
  const tentativa = texto.trim().slice(0, 100) // limita tamanho no log
  logger.info({ userId }, '[CONVITE] Código de convite não encontrado na primeira mensagem')
  await databaseService.registrarLog(userId, 'CODIGO_CONVITE_INVALIDO', { codigo_tentado: tentativa })
  await adapter.sendMessage(userId, { text: MSG_CODIGO_INVALIDO })
  return false
}

/**
 * Fallback: usuário chegou sem o link pré-preenchido e ainda não tem o código.
 * Salva estado Redis para aguardar o código na próxima mensagem.
 */
export async function solicitarCodigoConvite(
  adapter: IWhatsAppAdapter,
  userId: string,
  nomeContato?: string,
): Promise<void> {
  await definirEstado(userId, 'aguardando_codigo_convite', { nomeContato: nomeContato ?? null })
  await adapter.sendMessage(userId, { text: MSG_SOLICITAR_CODIGO })
}

/**
 * Trata a resposta do fallback: usuário está no estado `aguardando_codigo_convite`
 * e enviou uma mensagem com (ou sem) o código.
 * Retorna true se aceito, false se rejeitado (resposta já enviada).
 */
export async function handleCodigoConvite(
  adapter: IWhatsAppAdapter,
  userId: string,
  texto: string,
): Promise<boolean> {
  const codigo = codigoConfigurado()

  if (!codigo) {
    logger.warn({ userId }, '[CONVITE] CODIGO_CONVITE não configurado — acesso liberado sem validação')
    await limparEstado(userId)
    return true
  }

  if (textoContemCodigo(texto)) {
    logger.info({ userId }, '[CONVITE] Código de convite aceito (fallback)')
    await databaseService.registrarLog(userId, 'CODIGO_CONVITE_ACEITO', null)
    await limparEstado(userId)
    return true
  }

  const tentativa = texto.trim().slice(0, 100)
  logger.info({ userId }, '[CONVITE] Código de convite inválido (fallback)')
  await databaseService.registrarLog(userId, 'CODIGO_CONVITE_INVALIDO', { codigo_tentado: tentativa })
  await adapter.sendMessage(userId, { text: MSG_CODIGO_INVALIDO })
  return false
}

export async function codigoConviteAdminCommand(
  adapter: IWhatsAppAdapter,
  userId: string,
): Promise<void> {
  const codigo = codigoConfigurado()
  const exibir = codigo || '(não configurado — variável CODIGO_CONVITE ausente)'
  await adapter.sendMessage(userId, { text: `*Código de convite atual:* \`${exibir}\`` })
}
