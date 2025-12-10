// ===== CONFIGURAÇÃO DE USUÁRIOS =====
// Carrega variáveis de ambiente (no index.ts já é feito, mas aqui reforçamos para segurança)
import 'dotenv/config'

// Função para formatar número de telefone
function formatPhoneNumber(phoneNumber: string): string {
  // Remove caracteres especiais
  let clean = phoneNumber.replace(/\D/g, '')
  // Adiciona código do país se não tiver
  if (!clean.startsWith('55')) {
    clean = '55' + clean
  }
  // Adiciona sufixo do WhatsApp
  return clean + '@s.whatsapp.net'
}

// Normaliza valor da env para JID do WhatsApp
function normalizeJid(input: string): string {
  const s = input.trim()
  // Se já está em formato JID, retorna como está
  if (s.endsWith('@s.whatsapp.net')) return s
  // Caso contrário, tenta formatar como número
  return formatPhoneNumber(s)
}

function parseUsersFromEnv(envName: string, fallback: string[] = []): string[] {
  const raw = process.env[envName]
  if (!raw) {
    // Comportamento padrão seguro em desenvolvimento: usar fallback
    // Comentário: Se ADMIN_USERS/AUTHORIZED_USERS não forem definidos, usa fallback
    return [...fallback]
  }
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normalizeJid)
}

// Lista de usuários autorizados (ADMINISTRADORES)
// Em produção, defina via env ADMIN_USERS="5511999999999,5511888888888"
const ADMIN_USERS: string[] = parseUsersFromEnv('ADMIN_USERS', [])

// Lista de usuários autorizados (USUÁRIOS NORMAIS)
// Em produção, defina via env AUTHORIZED_USERS="5511999999999,5511666666666"
// Padrão: se AUTHORIZED_USERS não estiver definido, usa os ADMIN_USERS como autorizados
const AUTHORIZED_USERS: string[] = parseUsersFromEnv('AUTHORIZED_USERS', ADMIN_USERS)

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
function isValidWhatsAppNumber(number: string): boolean {
  // Formato esperado: 5511999999999@s.whatsapp.net
  const regex = /^55\d{10,11}@s\.whatsapp\.net$/;
  return regex.test(number);
}

// Função para adicionar usuário
function addUser(phoneNumber: string): string {
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
function removeUser(phoneNumber: string): string {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  const index = AUTHORIZED_USERS.indexOf(formattedNumber);
  if (index === -1) {
    throw new Error('Usuário não encontrado na lista');
  }
  AUTHORIZED_USERS.splice(index, 1);
  return formattedNumber;
}

// Função para formatar número de telefone
// formatPhoneNumber já definido acima

// Função para listar usuários
function listUsers() {
  return {
    admins: [...ADMIN_USERS],
    users: [...AUTHORIZED_USERS],
    total: AUTHORIZED_USERS.length,
    max: SYSTEM_CONFIG.MAX_USERS
  };
}

export {
  ADMIN_USERS,
  AUTHORIZED_USERS,
  SYSTEM_CONFIG,
  isValidWhatsAppNumber,
  addUser,
  removeUser,
  formatPhoneNumber,
  listUsers
}; 
