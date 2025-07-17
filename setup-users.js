#!/usr/bin/env node

// ===== SCRIPT DE CONFIGURAÇÃO DE USUÁRIOS =====

const fs = require('fs');
const path = require('path');

console.log('🔧 Configuração de Usuários do Simplou\n');

// Função para validar número de WhatsApp
function isValidWhatsAppNumber(number) {
  const regex = /^55\d{10,11}@s\.whatsapp\.net$/;
  return regex.test(number);
}

// Função para formatar número de telefone
function formatPhoneNumber(phoneNumber) {
  let clean = phoneNumber.replace(/\D/g, '');
  
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  return clean + '@s.whatsapp.net';
}

// Função para ler o arquivo config.js atual
function readCurrentConfig() {
  try {
    const configPath = path.join(__dirname, 'config.js');
    const content = fs.readFileSync(configPath, 'utf8');
    
    // Extrair ADMIN_USERS
    const adminMatch = content.match(/const ADMIN_USERS = \[([\s\S]*?)\];/);
    const adminUsers = adminMatch ? 
      adminMatch[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('@s.whatsapp.net'))
        .map(line => line.replace(/['",]/g, '').trim()) : [];
    
    // Extrair AUTHORIZED_USERS
    const authMatch = content.match(/const AUTHORIZED_USERS = \[([\s\S]*?)\];/);
    const authorizedUsers = authMatch ? 
      authMatch[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('@s.whatsapp.net'))
        .map(line => line.replace(/['",]/g, '').trim()) : [];
    
    return { adminUsers, authorizedUsers };
  } catch (error) {
    console.error('❌ Erro ao ler config.js:', error.message);
    return { adminUsers: [], authorizedUsers: [] };
  }
}

// Função para gerar novo config.js
function generateConfig(adminUsers, authorizedUsers) {
  const configContent = `// ===== CONFIGURAÇÃO DE USUÁRIOS =====

// Lista de usuários autorizados (ADMINISTRADORES)
// Substitua pelos números reais dos administradores
const ADMIN_USERS = [
${adminUsers.map(user => `  '${user}', // Administrador`).join('\n')}
];

// Lista de usuários autorizados (USUÁRIOS NORMAIS)
// Substitua pelos números reais dos usuários (máximo 5 usuários)
const AUTHORIZED_USERS = [
${authorizedUsers.map(user => `  '${user}', // Usuário autorizado`).join('\n')}
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
  const regex = /^55\\d{10,11}@s\\.whatsapp\\.net$/;
  return regex.test(number);
}

// Função para adicionar usuário
function addUser(phoneNumber) {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  
  if (!isValidWhatsAppNumber(formattedNumber)) {
    throw new Error('Número de telefone inválido. Use formato: 5511999999999');
  }
  
  if (AUTHORIZED_USERS.length >= SYSTEM_CONFIG.MAX_USERS) {
    throw new Error(\`Máximo de \${SYSTEM_CONFIG.MAX_USERS} usuários atingido\`);
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
  let clean = phoneNumber.replace(/\\D/g, '');
  
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
`;

  return configContent;
}

// Função principal
function main() {
  const { adminUsers, authorizedUsers } = readCurrentConfig();
  
  console.log('📋 Usuários atuais:');
  console.log('👑 Administradores:', adminUsers.length);
  adminUsers.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user}`);
  });
  
  console.log('\n👥 Usuários autorizados:', authorizedUsers.length);
  authorizedUsers.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user}`);
  });
  
  console.log('\n🔧 Opções:');
  console.log('1. Adicionar administrador');
  console.log('2. Adicionar usuário autorizado');
  console.log('3. Remover usuário');
  console.log('4. Listar usuários');
  console.log('5. Sair');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nEscolha uma opção (1-5): ', (answer) => {
    switch(answer.trim()) {
      case '1':
        rl.question('Digite o número do administrador (ex: 5511999999999): ', (number) => {
          const formattedNumber = formatPhoneNumber(number);
          if (isValidWhatsAppNumber(formattedNumber)) {
            adminUsers.push(formattedNumber);
            const newConfig = generateConfig(adminUsers, authorizedUsers);
            fs.writeFileSync('config.js', newConfig);
            console.log('✅ Administrador adicionado com sucesso!');
          } else {
            console.log('❌ Número inválido!');
          }
          rl.close();
        });
        break;
        
      case '2':
        rl.question('Digite o número do usuário (ex: 5511999999999): ', (number) => {
          const formattedNumber = formatPhoneNumber(number);
          if (isValidWhatsAppNumber(formattedNumber)) {
            if (authorizedUsers.length >= 5) {
              console.log('❌ Máximo de 5 usuários atingido!');
            } else {
              authorizedUsers.push(formattedNumber);
              const newConfig = generateConfig(adminUsers, authorizedUsers);
              fs.writeFileSync('config.js', newConfig);
              console.log('✅ Usuário adicionado com sucesso!');
            }
          } else {
            console.log('❌ Número inválido!');
          }
          rl.close();
        });
        break;
        
      case '3':
        console.log('Usuários disponíveis para remoção:');
        [...adminUsers, ...authorizedUsers].forEach((user, index) => {
          console.log(`${index + 1}. ${user}`);
        });
        rl.question('Digite o número do usuário para remover: ', (number) => {
          const formattedNumber = formatPhoneNumber(number);
          const allUsers = [...adminUsers, ...authorizedUsers];
          const index = allUsers.indexOf(formattedNumber);
          
          if (index !== -1) {
            if (index < adminUsers.length) {
              adminUsers.splice(index, 1);
            } else {
              authorizedUsers.splice(index - adminUsers.length, 1);
            }
            const newConfig = generateConfig(adminUsers, authorizedUsers);
            fs.writeFileSync('config.js', newConfig);
            console.log('✅ Usuário removido com sucesso!');
          } else {
            console.log('❌ Usuário não encontrado!');
          }
          rl.close();
        });
        break;
        
      case '4':
        console.log('\n📋 Lista atual de usuários:');
        console.log('👑 Administradores:', adminUsers.length);
        adminUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user}`);
        });
        console.log('\n👥 Usuários autorizados:', authorizedUsers.length);
        authorizedUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user}`);
        });
        rl.close();
        break;
        
      case '5':
        console.log('👋 Até logo!');
        rl.close();
        break;
        
      default:
        console.log('❌ Opção inválida!');
        rl.close();
    }
  });
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { main, readCurrentConfig, generateConfig }; 