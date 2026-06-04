import * as databaseService from '../infrastructure/databaseService';
import { perguntarNome } from './onboarding';
import { definirEstado } from '../configs/stateManager';
import { logger } from '../infrastructure/logger';

export async function listarFilaEsperaCommand(sock: any, adminId: string): Promise<void> {
  const fila = await databaseService.listarFilaEspera();

  if (fila.length === 0) {
    await sock.sendMessage(adminId, { text: '✅ Nenhum usuário aguardando aprovação.' });
    return;
  }

  const linhas = fila.map((u, i) => {
    const data = new Date(u.criado_em).toLocaleDateString('pt-BR');
    const numero = u.user_id.replace('@s.whatsapp.net', '');
    return `${i + 1}. *${u.nome || 'Sem nome'}* — \`${numero}\` (${data})`;
  });

  await sock.sendMessage(adminId, {
    text: `⏳ *Fila de espera (${fila.length})*\n\n${linhas.join('\n')}\n\nPara aprovar: _aprovar <numero>_`,
  });
}

export async function aprovarUsuarioCommand(sock: any, adminId: string, texto: string): Promise<void> {
  const match = texto.match(/aprovar\s+(\d+)/i);
  if (!match) {
    await sock.sendMessage(adminId, { text: '❌ Formato inválido. Use: _aprovar <numero>_\n\nEx: _aprovar 5561999887766_' });
    return;
  }

  const numero = match[1].replace(/\D/g, '');
  const userId = `${numero}@s.whatsapp.net`;

  const usuario = await databaseService.buscarUsuario(userId);
  if (!usuario) {
    await sock.sendMessage(adminId, { text: `❌ Usuário \`${numero}\` não encontrado na fila.` });
    return;
  }
  if (usuario.status !== 'aguardando') {
    await sock.sendMessage(adminId, { text: `ℹ️ Usuário \`${numero}\` já está com status *${usuario.status}*.` });
    return;
  }

  const aprovado = await databaseService.aprovarUsuarioBeta(userId, adminId);
  if (!aprovado) {
    await sock.sendMessage(adminId, { text: '❌ Não foi possível aprovar. Tente novamente.' });
    return;
  }

  logger.info({ userId, adminId }, '[BETA] Usuário aprovado');
  await sock.sendMessage(adminId, { text: `✅ *${usuario.nome || numero}* aprovado! Iniciando onboarding...` });

  // Notifica o usuário aprovado e inicia o onboarding
  await sock.sendMessage(userId, {
    text:
      '🎉 *Sua solicitação foi aprovada!*\n\n' +
      'Bem-vindo ao Simplou Driver — seu assistente financeiro no WhatsApp para motoristas e entregadores.\n\n' +
      'Vamos configurar sua conta em alguns passos rápidos.',
  });
  await definirEstado(userId, 'onboarding_nome', { nomeProfile: usuario.nome });
  await perguntarNome(sock, userId, usuario.nome);
}
