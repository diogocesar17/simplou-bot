import 'dotenv/config'
import * as databaseService from '../../databaseService'

// Normaliza entradas (número puro ou JID) para JID do WhatsApp
function formatPhoneNumber(phoneNumber: string): string {
  let clean = phoneNumber.replace(/\D/g, '')
  if (!clean.startsWith('55')) {
    clean = '55' + clean
  }
  return clean + '@s.whatsapp.net'
}

function normalizeJid(input: string): string {
  const s = input.trim()
  if (s.endsWith('@s.whatsapp.net')) return s
  return formatPhoneNumber(s)
}

function parseEnvList(envName: string): string[] {
  const raw = process.env[envName]
  if (!raw) return []
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normalizeJid)
}

const SUPER_ADMINS: string[] = parseEnvList('SUPER_ADMINS')
const AUTHORIZED_FALLBACK: string[] = parseEnvList('AUTHORIZED_USERS')

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    // Fallback/Bootstrap: super-admins via env
    if (SUPER_ADMINS.includes(userId)) return true

    // Banco: checar flag is_admin
    const usuario = await databaseService.buscarUsuario(userId)
    return Boolean(usuario?.is_admin)
  } catch (error) {
    // Em falha de banco, negar por segurança
    return false
  }
}

export async function isAuthorized(userId: string): Promise<boolean> {
  try {
    // Super-admins são sempre autorizados
    if (SUPER_ADMINS.includes(userId)) return true
    // Fallback via env: usuários explicitamente autorizados
    if (AUTHORIZED_FALLBACK.includes(userId)) return true

    // Banco: usar verificação central
    const acesso = await databaseService.verificarAcessoUsuario(userId)
    return Boolean(acesso?.acesso)
  } catch (error) {
    // Em falha de banco, negar por segurança
    return false
  }
}
