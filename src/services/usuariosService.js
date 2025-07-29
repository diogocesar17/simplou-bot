const { 
  verificarAcessoUsuario: verificarAcessoDB,
  listarUsuarios: listarUsuariosDB,
  buscarUsuario: buscarUsuarioDB,
  cadastrarUsuario: cadastrarUsuarioDB,
  promoverParaPremium: promoverParaPremiumDB,
  removerUsuario: removerUsuarioDB,
  registrarAcesso: registrarAcessoDB,
  buscarUsuariosPremiumExpiracao: buscarUsuariosPremiumExpiracaoDB
} = require('../../databaseService');

const { logger } = require('../../logger');

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
    
    // Remover usuário
    await removerUsuario(userId, adminId);
    
    return {
      success: true,
      message: `✅ Usuário removido com sucesso!\n\n👤 Nome: ${usuarioExistente.nome}\n📱 Telefone: ${telefone}\n📅 Removido em: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    };
    
  } catch (error) {
    logger.error('Erro ao processar comando remover:', error);
    return {
      success: false,
      message: `❌ Erro: ${error.message}`
    };
  }
}

// Função para processar comando de listagem de usuários
async function processarComandoUsuarios(filtros = {}) {
  try {
    const usuarios = await listarUsuarios(filtros);
    
    if (!usuarios || usuarios.length === 0) {
      return {
        success: true,
        message: '📋 Nenhum usuário encontrado.'
      };
    }
    
    let mensagem = `📋 *Lista de Usuários* (${usuarios.length})\n\n`;
    
    usuarios.forEach((usuario, index) => {
      const status = usuario.plano === 'premium' ? '💎 Premium' : '🆓 Gratuito';
      const admin = usuario.is_admin ? ' 👑 Admin' : '';
      const dataCadastro = new Date(usuario.data_criacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      
      mensagem += `${index + 1}. *${usuario.nome}*\n`;
      mensagem += `   📱 ${usuario.user_id.replace('@s.whatsapp.net', '')}\n`;
      mensagem += `   ${status}${admin}\n`;
      mensagem += `   📅 ${dataCadastro}\n\n`;
    });
    
    return {
      success: true,
      message: mensagem
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
    
    const status = usuario.plano === 'premium' ? '💎 Premium' : '🆓 Gratuito';
    const admin = usuario.is_admin ? ' 👑 Admin' : '';
    const dataCadastro = new Date(usuario.data_criacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    let mensagem = `👤 *Status do Usuário*\n\n`;
    mensagem += `📝 Nome: ${usuario.nome}\n`;
    mensagem += `📱 Telefone: ${telefone}\n`;
    mensagem += `🎯 Plano: ${status}${admin}\n`;
    mensagem += `📅 Cadastrado em: ${dataCadastro}\n`;
    
    if (usuario.data_expiracao_premium) {
      const dataExpiracao = new Date(usuario.data_expiracao_premium).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      mensagem += `⏰ Expira em: ${dataExpiracao}\n`;
    }
    
    if (usuario.ultimo_acesso) {
      const ultimoAcesso = new Date(usuario.ultimo_acesso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      mensagem += `🕐 Último acesso: ${ultimoAcesso}\n`;
    }
    
    return {
      success: true,
      message: mensagem
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
    const usuario = await buscarUsuario(userId);
    return usuario && usuario.is_admin === true;
  } catch (error) {
    logger.error('Erro ao verificar admin:', error);
    return false;
  }
}

// Função para gerar mensagem de boas-vindas
function gerarMensagemBoasVindas(usuario) {
  return `🎉 *Bem-vindo ao Simplou!*\n\n` +
         `👤 Olá ${usuario.nome}!\n\n` +
         `💰 *Seu assistente financeiro pessoal*\n\n` +
         `📊 *Comandos principais:*\n` +
         `• resumo: ver resumo do mês\n` +
         `• gastei 50 no mercado: registrar gasto\n` +
         `• recebi 1000 salário: registrar receita\n` +
         `• histórico: ver últimos lançamentos\n` +
         `• ajuda: menu completo\n\n` +
         `💡 *Dica:* Digite *ajuda* para ver todos os comandos disponíveis!`;
}

// Função para gerar mensagem de promoção premium
function gerarMensagemPromocaoPremium(usuario, diasExpiracao) {
  let mensagem = `🎉 *Parabéns! Você foi promovido para Premium!*\n\n`;
  mensagem += `👤 ${usuario.nome}\n`;
  mensagem += `💎 Plano: Premium\n`;
  
  if (diasExpiracao) {
    mensagem += `📅 Expira em ${diasExpiracao} dias\n\n`;
  }
  
  mensagem += `✨ *Benefícios Premium:*\n`;
  mensagem += `• Análises inteligentes de gastos\n`;
  mensagem += `• Sugestões personalizadas\n`;
  mensagem += `• Previsões financeiras\n`;
  mensagem += `• Suporte prioritário\n\n`;
  mensagem += `🚀 Aproveite todos os recursos!`;
  
  return mensagem;
}

async function verificarAcessoUsuario(userId) {
  try {
    return await verificarAcessoDB(userId);
  } catch (error) {
    console.error('Erro ao verificar acesso do usuário:', error);
    throw new Error('Erro ao verificar acesso do usuário');
  }
}

async function listarUsuarios(filtros = {}) {
  try {
    return await listarUsuariosDB(filtros);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    throw new Error('Erro ao listar usuários');
  }
}

async function buscarUsuario(userId) {
  try {
    return await buscarUsuarioDB(userId);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    throw new Error('Erro ao buscar usuário');
  }
}

async function cadastrarUsuario(userId, dados) {
  try {
    return await cadastrarUsuarioDB(userId, dados);
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    throw new Error('Erro ao cadastrar usuário');
  }
}

async function promoverParaPremium(userId, diasExpiracao = null, promovidoPor) {
  try {
    return await promoverParaPremiumDB(userId, diasExpiracao, promovidoPor);
  } catch (error) {
    console.error('Erro ao promover usuário para premium:', error);
    throw new Error('Erro ao promover usuário para premium');
  }
}

async function removerUsuario(userId, removidoPor) {
  try {
    return await removerUsuarioDB(userId, removidoPor);
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    throw new Error('Erro ao remover usuário');
  }
}

async function registrarAcesso(userId) {
  try {
    return await registrarAcessoDB(userId);
  } catch (error) {
    console.error('Erro ao registrar acesso:', error);
    throw new Error('Erro ao registrar acesso');
  }
}

async function buscarUsuariosPremiumExpiracao(diasAntes = 7) {
  try {
    return await buscarUsuariosPremiumExpiracaoDB(diasAntes);
  } catch (error) {
    console.error('Erro ao buscar usuários premium com expiração:', error);
    throw new Error('Erro ao buscar usuários premium com expiração');
  }
}

module.exports = {
  verificarAcessoUsuario,
  listarUsuarios,
  buscarUsuario,
  cadastrarUsuario,
  promoverParaPremium,
  removerUsuario,
  registrarAcesso,
  buscarUsuariosPremiumExpiracao,
  processarComandoCadastrar,
  processarComandoPremium,
  processarComandoRemover,
  processarComandoUsuarios,
  processarComandoStatus,
  verificarAdmin,
  gerarMensagemBoasVindas,
  gerarMensagemPromocaoPremium
}; 