// @ts-nocheck
import * as usuariosService from '../services/usuariosService';
import * as sistemaService from '../services/sistemaService';
import { SYSTEM_CONFIG } from '../../config';

async function statusCommand(sock, userId) {
  // Buscar informações reais do sistema
  const totalLancamentos = await sistemaService.contarLancamentos();
  const usuarios = await usuariosService.listarUsuarios();
  const totalUsuarios = usuarios.length;
  const totalAdmins = usuarios.filter(u => u.is_admin).length;
  const totalPremium = usuarios.filter(u => u.plano === 'premium').length;
  const msg = `📊 *Status do Sistema*\n\n` +
    `👥 Usuários: ${totalUsuarios}\n` +
    `👑 Admins: ${totalAdmins}\n` +
    `💎 Premium: ${totalPremium}\n` +
    `📋 Total de lançamentos: ${totalLancamentos}\n` +
    `🤖 Versão: ${SYSTEM_CONFIG?.VERSION || '1.0.0'}\n` +
    `⏰ Última verificação: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
  await sock.sendMessage(userId, { text: msg });
}

export default statusCommand; 