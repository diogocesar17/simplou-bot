import * as databaseService from '../infrastructure/databaseService';
import * as authorizationService from './authorizationService';

// TODO: Tipar corretamente. Usar any onde necessário.

// Funções para gerenciar usuários
export async function cadastrarUsuario(userId: string, dados: any): Promise<any> {
  return await databaseService.cadastrarUsuario(userId, dados);
}

export async function listarUsuarios(): Promise<any[]> {
  return await databaseService.listarUsuarios();
}

export async function buscarUsuario(userId: string): Promise<any> {
  return await databaseService.buscarUsuario(userId);
}

export async function promoverParaPremium(userId: string, diasExpiracao: number | null | undefined = null, promovidoPor: string): Promise<any> {
  return await (databaseService as any).promoverParaPremium(userId, diasExpiracao ?? null, promovidoPor);
}

export async function removerUsuario(userId: string, removidoPor: string): Promise<any> {
  return await databaseService.removerUsuario(userId, removidoPor);
}

export async function verificarAcessoUsuario(userId: string): Promise<any> {
  return await databaseService.verificarAcessoUsuario(userId);
}

export async function registrarAcesso(userId: string): Promise<any> {
  return await databaseService.registrarAcesso(userId);
}

export async function buscarUsuariosPremiumExpiracao(dias: number = 7): Promise<any[]> {
  return await databaseService.buscarUsuariosPremiumExpiracao(dias);
}

// Função para verificar se usuário é admin
export async function verificarAdmin(userId: string): Promise<boolean> {
  return await authorizationService.isAdmin(userId);
}

// Nova verificação unificada de autorização (via banco + fallback SUPER_ADMINS)
export async function verificarAutorizado(userId: string): Promise<boolean> {
  return await authorizationService.isAuthorized(userId);
}

// Função para processar comando de listagem de usuários
export async function processarComandoUsuarios(): Promise<any> {
  try {
    const usuarios = await databaseService.listarUsuarios();
    
    if (!usuarios || usuarios.length === 0) {
      return {
        success: false,
        message: '📄 Nenhum usuário encontrado no sistema.'
      };
    }
    
    let message = '👥 *Lista de Usuários:*\n\n';
    
    usuarios.forEach((usuario, index) => {
      const status = usuario.status === 'ativo' ? '✅' : '❌';
      const plano = usuario.plano === 'premium' ? '👑' : '📱';
      const admin = usuario.is_admin ? '👨‍💼' : '';
      
      message += `${index + 1}. ${status} ${plano} ${admin} *${usuario.nome || 'Sem nome'}*\n`;
      message += `   📱 ID: \`${usuario.user_id}\`\n`;
      message += `   📊 Plano: ${usuario.plano}\n`;
      message += `   📅 Status: ${usuario.status}\n`;
      if (usuario.criado_em) {
        message += `   🕐 Criado: ${new Date(usuario.criado_em).toLocaleDateString('pt-BR')}\n`;
      }
      message += '\n';
    });
    
    message += `📊 *Total: ${usuarios.length} usuário(s)*`;
    
    return {
      success: true,
      message
    };
  } catch (error: any) {
    console.error('Erro ao processar comando usuários:', error);
    return {
      success: false,
      message: '❌ Erro interno ao listar usuários.'
    };
  }
}

export async function ativarTrialPremium(userId: string): Promise<{ sucesso: boolean; motivo?: string }> {
  const usuario = await databaseService.buscarUsuario(userId);
  if (!usuario) return { sucesso: false, motivo: 'Usuário não encontrado.' };
  if (usuario.trial_ativado) return { sucesso: false, motivo: 'já_usado' };
  if (usuario.plano === 'premium') return { sucesso: false, motivo: 'já_premium' };

  const expiracao = new Date();
  expiracao.setDate(expiracao.getDate() + 7);

  await databaseService.queryDatabase(
    `UPDATE usuarios SET plano = 'premium', data_expiracao_premium = $2, trial_ativado = true, atualizado_em = CURRENT_TIMESTAMP WHERE user_id = $1`,
    [userId, expiracao]
  );
  return { sucesso: true };
}

// Função para processar comando de remoção de usuário
export async function processarComandoRemover(texto: string, adminId: string): Promise<any> {
  try {
    // Extrair ID do usuário do texto
    const match = texto.match(/remover\s+usuario\s+(.+)/i);
    if (!match) {
      return {
        success: false,
        message: '❌ Formato inválido. Use: *remover usuario <ID>*\n\n💡 *Exemplo:* remover usuario 556193096344@s.whatsapp.net'
      };
    }

    const userIdParaRemover = match[1].trim();
    
    // Verificar se não está tentando remover a si mesmo
    if (userIdParaRemover === adminId) {
      return {
        success: false,
        message: '❌ Você não pode remover a si mesmo.'
      };
    }
    
    // Verificar se o usuário existe
    const usuario = await databaseService.buscarUsuario(userIdParaRemover);
    if (!usuario) {
      return {
        success: false,
        message: '❌ Usuário não encontrado no sistema.'
      };
    }
    
    // Verificar se não está tentando remover outro admin
    if (usuario.is_admin) {
      return {
        success: false,
        message: '❌ Não é possível remover outro administrador.'
      };
    }
    
    // Remover usuário
    const resultado = await databaseService.removerUsuario(userIdParaRemover, adminId);
    
    if (resultado) {
      return {
        success: true,
        message: `✅ *Usuário removido com sucesso!*\n\n📱 ID: \`${userIdParaRemover}\`\n👤 Nome: ${usuario.nome || 'Sem nome'}\n📊 Plano: ${usuario.plano}\n👨‍💼 Removido por: ${adminId}`
      };
    } else {
      return {
        success: false,
        message: '❌ Erro ao remover usuário. Tente novamente.'
      };
    }
  } catch (error: any) {
    console.error('Erro ao processar comando remover:', error);
    return {
      success: false,
      message: '❌ Erro interno ao processar remoção.'
    };
  }
}
