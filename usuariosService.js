const { 
  cadastrarUsuario, 
  promoverParaPremium, 
  removerUsuario, 
  listarUsuarios, 
  buscarUsuario, 
  verificarAcessoUsuario,
  registrarAcesso,
  buscarUsuariosPremiumExpiracao
} = require('./databaseService');
const { logger, fileLogger } = require('./logger');

// Função para formatar número de telefone
function formatarTelefone(numero) {
  // Remove caracteres especiais
  let clean = numero.replace(/\D/g, '');
  
  // Adiciona código do país se não tiver
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  // Adiciona sufixo do WhatsApp
  return clean + '@s.whatsapp.net';
}

// Função para validar número de WhatsApp
function isValidWhatsAppNumber(number) {
  const regex = /^55\d{10,11}@s\.whatsapp\.net$/;
  return regex.test(number);
}

// Função para processar comando de cadastro
async function processarComandoCadastrar(texto, adminId) {
  try {
    // Formato: cadastrar 5511999999999 Nome do Usuário
    const match = texto.match(/^cadastrar\s+(\d+)\s+(.+)$/i);
    if (!match) {
      throw new Error('Formato inválido. Use: cadastrar 5511999999999 Nome do Usuário');
    }
    
    const [, telefone, nome] = match;
    const userId = formatarTelefone(telefone);
    
    if (!isValidWhatsAppNumber(userId)) {
      throw new Error('Número de telefone inválido. Use formato: 5511999999999');
    }
    
    // Verificar se usuário já existe
    const usuarioExistente = await buscarUsuario(userId);
    if (usuarioExistente) {
      throw new Error('Usuário já está cadastrado');
    }
    
    // Cadastrar usuário
    const usuario = await cadastrarUsuario(userId, {
      nome: nome.trim(),
      plano: 'gratuito',
      is_admin: false,
      criado_por: adminId
    });
    
    return {
      success: true,
      message: `✅ Usuário cadastrado com sucesso!\n\n👤 Nome: ${usuario.nome}\n📱 Telefone: ${telefone}\n🆓 Plano: Gratuito\n📅 Cadastrado em: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      usuario: usuario
    };
    
  } catch (error) {
    logger.error('Erro ao processar comando cadastrar:', error);
    return {
      success: false,
      message: `❌ Erro: ${error.message}`
    };
  }
}

// Função para processar comando de promoção premium
async function processarComandoPremium(texto, adminId) {
  try {
    // Formato: premium 5511999999999 [dias]
    const match = texto.match(/^premium\s+(\d+)(?:\s+(\d+))?$/i);
    if (!match) {
      throw new Error('Formato inválido. Use: premium 5511999999999 [dias]');
    }
    
    const [, telefone, diasStr] = match;
    const userId = formatarTelefone(telefone);
    const diasExpiracao = diasStr ? parseInt(diasStr) : null;
    
    if (!isValidWhatsAppNumber(userId)) {
      throw new Error('Número de telefone inválido. Use formato: 5511999999999');
    }
    
    // Verificar se usuário existe
    const usuarioExistente = await buscarUsuario(userId);
    if (!usuarioExistente) {
      throw new Error('Usuário não encontrado');
    }
    
    if (usuarioExistente.plano === 'premium') {
      throw new Error('Usuário já é premium');
    }
    
    // Promover para premium
    const usuario = await promoverParaPremium(userId, diasExpiracao, adminId);
    
    let mensagem = `✅ Usuário promovido para Premium!\n\n👤 Nome: ${usuario.nome}\n💎 Plano: Premium`;
    
    if (usuario.data_expiracao_premium) {
      const dataExpiracao = new Date(usuario.data_expiracao_premium).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      mensagem += `\n📅 Expira em: ${dataExpiracao}`;
    } else {
      mensagem += `\n📅 Sem prazo de expiração`;
    }
    
    return {
      success: true,
      message: mensagem,
      usuario: usuario
    };
    
  } catch (error) {
    logger.error('Erro ao processar comando premium:', error);
    return {
      success: false,
      message: `❌ Erro: ${error.message}`
    };
  }
}

// Função para processar comando de remoção
async function processarComandoRemover(texto, adminId) {
  try {
    // Formato: remover 5511999999999
    const match = texto.match(/^remover\s+(\d+)$/i);
    if (!match) {
      throw new Error('Formato inválido. Use: remover 5511999999999');
    }
    
    const [, telefone] = match;
    const userId = formatarTelefone(telefone);
    
    if (!isValidWhatsAppNumber(userId)) {
      throw new Error('Número de telefone inválido. Use formato: 5511999999999');
    }
    
    // Verificar se usuário existe
    const usuarioExistente = await buscarUsuario(userId);
    if (!usuarioExistente) {
      throw new Error('Usuário não encontrado');
    }
    
    // Não permitir remover admins
    if (usuarioExistente.is_admin) {
      throw new Error('Não é possível remover um administrador');
    }
    
    // Remover usuário
    const usuario = await removerUsuario(userId, adminId);
    
    return {
      success: true,
      message: `✅ Usuário removido com sucesso!\n\n👤 Nome: ${usuario.nome}\n📱 Telefone: ${telefone}\n🗑️ Removido em: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      usuario: usuario
    };
    
  } catch (error) {
    logger.error('Erro ao processar comando remover:', error);
    return {
      success: false,
      message: `❌ Erro: ${error.message}`
    };
  }
}

// Função para processar comando de listagem
async function processarComandoUsuarios(filtros = {}) {
  try {
    const usuarios = await listarUsuarios(filtros);
    
    if (usuarios.length === 0) {
      return {
        success: true,
        message: '📊 Nenhum usuário encontrado.'
      };
    }
    
    let mensagem = `📊 *Usuários Cadastrados:*\n\n`;
    
    for (const usuario of usuarios) {
      const emojiPlano = usuario.plano === 'premium' ? '💎' : '🆓';
      const emojiAdmin = usuario.is_admin ? '👑' : '👤';
      const status = usuario.status === 'ativo' ? '✅' : '❌';
      
      let linha = `${emojiAdmin} ${usuario.nome} (${usuario.user_id.replace('@s.whatsapp.net', '')})\n`;
      linha += `   ${emojiPlano} ${usuario.plano.toUpperCase()} - ${status} ${usuario.status}\n`;
      
      if (usuario.data_ultimo_acesso) {
        const ultimoAcesso = new Date(usuario.data_ultimo_acesso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        linha += `   📅 Último acesso: ${ultimoAcesso}\n`;
      }
      
      if (usuario.plano === 'premium' && usuario.data_expiracao_premium) {
        const expiracao = new Date(usuario.data_expiracao_premium).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        linha += `   ⏰ Expira em: ${expiracao}\n`;
      }
      
      mensagem += linha + '\n';
    }
    
    const totalAtivos = usuarios.filter(u => u.status === 'ativo').length;
    const totalPremium = usuarios.filter(u => u.plano === 'premium').length;
    
    mensagem += `📈 *Resumo:*\n`;
    mensagem += `   👥 Total: ${usuarios.length} usuários\n`;
    mensagem += `   ✅ Ativos: ${totalAtivos}\n`;
    mensagem += `   💎 Premium: ${totalPremium}`;
    
    return {
      success: true,
      message: mensagem,
      usuarios: usuarios
    };
    
  } catch (error) {
    logger.error('Erro ao processar comando usuarios:', error);
    return {
      success: false,
      message: `❌ Erro: ${error.message}`
    };
  }
}

// Função para processar comando de status de usuário
async function processarComandoStatus(texto) {
  try {
    // Formato: status 5511999999999
    const match = texto.match(/^status\s+(\d+)$/i);
    if (!match) {
      throw new Error('Formato inválido. Use: status 5511999999999');
    }
    
    const [, telefone] = match;
    const userId = formatarTelefone(telefone);
    
    if (!isValidWhatsAppNumber(userId)) {
      throw new Error('Número de telefone inválido. Use formato: 5511999999999');
    }
    
    // Buscar usuário
    const usuario = await buscarUsuario(userId);
    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }
    
    const emojiPlano = usuario.plano === 'premium' ? '💎' : '🆓';
    const emojiAdmin = usuario.is_admin ? '👑' : '👤';
    const status = usuario.status === 'ativo' ? '✅' : '❌';
    
    let mensagem = `📊 *Status do Usuário*\n\n`;
    mensagem += `${emojiAdmin} **Nome:** ${usuario.nome}\n`;
    mensagem += `📱 **Telefone:** ${usuario.user_id.replace('@s.whatsapp.net', '')}\n`;
    mensagem += `${emojiPlano} **Plano:** ${usuario.plano.toUpperCase()}\n`;
    mensagem += `${status} **Status:** ${usuario.status}\n`;
    mensagem += `📅 **Cadastrado em:** ${new Date(usuario.data_cadastro).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
    
    if (usuario.data_ultimo_acesso) {
      mensagem += `🕐 **Último acesso:** ${new Date(usuario.data_ultimo_acesso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
    }
    
    if (usuario.plano === 'premium' && usuario.data_expiracao_premium) {
      const expiracao = new Date(usuario.data_expiracao_premium);
      const agora = new Date();
      const diasRestantes = Math.ceil((expiracao - agora) / (1000 * 60 * 60 * 24));
      
      mensagem += `⏰ **Expira em:** ${expiracao.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
      mensagem += `📆 **Dias restantes:** ${diasRestantes}\n`;
    }
    
    if (usuario.criado_por && usuario.criado_por !== 'sistema') {
      mensagem += `👤 **Cadastrado por:** ${usuario.criado_por.replace('@s.whatsapp.net', '')}\n`;
    }
    
    return {
      success: true,
      message: mensagem,
      usuario: usuario
    };
    
  } catch (error) {
    logger.error('Erro ao processar comando status:', error);
    return {
      success: false,
      message: `❌ Erro: ${error.message}`
    };
  }
}

// Função para verificar se usuário é admin
async function verificarAdmin(userId) {
  try {
    const acesso = await verificarAcessoUsuario(userId);
    return acesso.acesso && acesso.is_admin;
  } catch (error) {
    logger.error('Erro ao verificar admin:', error);
    return false;
  }
}

// Função para gerar mensagem de boas-vindas
function gerarMensagemBoasVindas(usuario) {
  return `🎉 *Bem-vindo ao FinanceBot!*\n\n👤 Olá ${usuario.nome}!\n\n` +
         `🆓 Você está no plano **Gratuito** com acesso a:\n` +
         `✅ Registro de gastos e receitas\n` +
         `✅ Categorização automática\n` +
         `✅ Resumos mensais\n` +
         `✅ Gestão de cartões\n` +
         `✅ Sistema de alertas\n\n` +
         `💎 Para acessar funcionalidades **Premium** como metas financeiras e análises inteligentes, entre em contato com o administrador.\n\n` +
         `📱 Digite *ajuda* para ver todos os comandos disponíveis.`;
}

// Função para gerar mensagem de promoção premium
function gerarMensagemPromocaoPremium(usuario, diasExpiracao) {
  let mensagem = `🎉 *Parabéns! Você foi promovido para Premium!*\n\n` +
                 `👤 Olá ${usuario.nome}!\n\n` +
                 `💎 Agora você tem acesso ao plano **Premium** com:\n` +
                 `✅ Todas as funcionalidades gratuitas\n` +
                 `🎯 Sistema de metas financeiras\n` +
                 `🤖 Análises inteligentes com IA\n` +
                 `📊 Relatórios avançados\n` +
                 `🔔 Alertas personalizados\n\n`;
  
  if (diasExpiracao) {
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + diasExpiracao);
    mensagem += `⏰ Seu plano Premium expira em: ${dataExpiracao.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n`;
  } else {
    mensagem += `⏰ Seu plano Premium não tem prazo de expiração\n\n`;
  }
  
  mensagem += `🚀 Comece agora mesmo! Digite *ajuda* para ver os novos comandos disponíveis.`;
  
  return mensagem;
}

module.exports = {
  formatarTelefone,
  isValidWhatsAppNumber,
  processarComandoCadastrar,
  processarComandoPremium,
  processarComandoRemover,
  processarComandoUsuarios,
  processarComandoStatus,
  verificarAdmin,
  gerarMensagemBoasVindas,
  gerarMensagemPromocaoPremium,
  buscarUsuariosPremiumExpiracao
}; 