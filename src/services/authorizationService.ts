import * as databaseService from '../infrastructure/databaseService'

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const usuario = await databaseService.buscarUsuario(userId)
    return Boolean(usuario?.is_admin)
  } catch {
    return false
  }
}

export async function isAuthorized(userId: string): Promise<boolean> {
  try {
    const acesso = await databaseService.verificarAcessoUsuario(userId)
    return Boolean(acesso?.acesso)
  } catch {
    return false
  }
}
