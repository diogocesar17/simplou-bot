// ===== CONFIGURAÇÃO DE USUÁRIOS =====

// Lista de usuários autorizados (ADMINISTRADORES)
// Substitua pelos números reais dos administradores
const ADMIN_USERS = [
  '556181429135@s.whatsapp.net', // Seu número (administrador principal)
  // Adicione outros números de administradores aqui
];

// Lista de usuários autorizados (USUÁRIOS NORMAIS)
// Substitua pelos números reais dos usuários (máximo 5 usuários)
const AUTHORIZED_USERS = [
  '556181429135@s.whatsapp.net', // Seu número (administrador)
  // Adicione outros usuários aqui (máximo 4 usuários adicionais)
  // '5511888888888@s.whatsapp.net', // Usuário 1
  // '5511777777777@s.whatsapp.net', // Usuário 2
  // '5511666666666@s.whatsapp.net', // Usuário 3
  // '5511555555555@s.whatsapp.net', // Usuário 4
];

// Configurações do sistema
const SYSTEM_CONFIG = {
  VERSION: '1.0.0',
  MAX_USERS: 5,
  BACKUP_RETENTION_DAYS: 730, // 2 anos
  CLEANUP_RETENTION_DAYS: 730, // 2 anos
  ALERT_HOURS: {
    START: 8,
    END: 12
  }
};

// Função para validar número de WhatsApp
function isValidWhatsAppNumber(number) {
  // Formato esperado: 5511999999999@s.whatsapp.net
  const regex = /^55\d{10,11}@s\.whatsapp\.net$/;
  return regex.test(number);
}

// Função para adicionar usuário
function addUser(phoneNumber) {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  
  if (!isValidWhatsAppNumber(formattedNumber)) {
    throw new Error('Número de telefone inválido. Use formato: 5511999999999');
  }
  
  if (AUTHORIZED_USERS.length >= SYSTEM_CONFIG.MAX_USERS) {
    throw new Error(`Máximo de ${SYSTEM_CONFIG.MAX_USERS} usuários atingido`);
  }
  
  if (AUTHORIZED_USERS.includes(formattedNumber)) {
    throw new Error('Usuário já está na lista de autorizados');
  }
  
  AUTHORIZED_USERS.push(formattedNumber);
  return formattedNumber;
}

// Função para remover usuário
function removeUser(phoneNumber) {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  const index = AUTHORIZED_USERS.indexOf(formattedNumber);
  
  if (index === -1) {
    throw new Error('Usuário não encontrado na lista');
  }
  
  AUTHORIZED_USERS.splice(index, 1);
  return formattedNumber;
}

// Função para formatar número de telefone
function formatPhoneNumber(phoneNumber) {
  // Remove caracteres especiais
  let clean = phoneNumber.replace(/\D/g, '');
  
  // Adiciona código do país se não tiver
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  // Adiciona sufixo do WhatsApp
  return clean + '@s.whatsapp.net';
}

// Função para listar usuários
function listUsers() {
  return {
    admins: [...ADMIN_USERS],
    users: [...AUTHORIZED_USERS],
    total: AUTHORIZED_USERS.length,
    max: SYSTEM_CONFIG.MAX_USERS
  };
}

module.exports = {
  ADMIN_USERS,
  AUTHORIZED_USERS,
  SYSTEM_CONFIG,
  isValidWhatsAppNumber,
  addUser,
  removeUser,
  formatPhoneNumber,
  listUsers
}; 