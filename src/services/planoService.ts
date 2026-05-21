import { buscarUsuario } from '../infrastructure/databaseService';

export async function isPremium(userId: string): Promise<boolean> {
  const usuario = await buscarUsuario(userId);
  if (!usuario) return false;
  if (usuario.plano !== 'premium') return false;
  if (usuario.data_expiracao_premium) {
    return new Date() < new Date(usuario.data_expiracao_premium);
  }
  return true;
}

export const MSG_UPGRADE =
  '⭐ *Recurso exclusivo Premium*\n\n' +
  'Este recurso está disponível apenas no plano Premium.\n\n' +
  'Digite *assinar* para ver os planos disponíveis.';
