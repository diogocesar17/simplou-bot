import * as usuariosService from '../services/usuariosService';
import * as sistemaService from '../services/sistemaService';
import { SYSTEM_CONFIG } from '../../config';
import { formatarMensagem } from '../utils/formatMessages';

async function statusCommand(sock, userId) {
  // Buscar informações reais do sistema
  const totalLancamentos = await sistemaService.contarLancamentos();
  const usuarios = await usuariosService.listarUsuarios();
  const totalUsuarios = usuarios.length;
  const totalAdmins = usuarios.filter(u => u.is_admin).length;
  const totalPremium = usuarios.filter(u => u.plano === 'premium').length;
  
  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Status do Sistema',
      emojiTitulo: '📊',
      secoes: [
        {
          titulo: 'Estatísticas Gerais',
          itens: [
            `Usuários: ${totalUsuarios}`,
            `Admins: ${totalAdmins}`,
            `Premium: ${totalPremium}`,
            `Total de lançamentos: ${totalLancamentos}`,
            `Versão: ${SYSTEM_CONFIG?.VERSION || '1.0.0'}`,
            `Última verificação: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
          ],
          emoji: '📈'
        }
      ]
    })
  });
}

export default statusCommand;