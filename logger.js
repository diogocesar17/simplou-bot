const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configuração do nível de log para o console
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

// Logger para console (colorido, legível)
const consoleStream = pino(
  { level },
  pino.transport({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' }
  })
);

// Função para criar logger de arquivo com rotação
function createFileLogger() {
  try {
    // Determinar diretório de logs
    const logDir = process.env.NODE_ENV === 'production' ? '/app/logs' : path.join(__dirname, 'logs');
    
    // Criar diretório se não existir
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      console.log(`📁 Diretório de logs criado: ${logDir}`);
    }
    
    // Verificar permissões de escrita
    try {
      fs.accessSync(logDir, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`Sem permissão de escrita no diretório: ${logDir}`);
    }
    
    // Tentar importar rotating-file-stream
    let rfs;
    try {
      rfs = require('rotating-file-stream');
    } catch (error) {
      throw new Error('Pacote rotating-file-stream não disponível');
    }
    
    // Criar stream rotativo
    const rotatingStream = rfs.createStream('app.log', {
      interval: '1d', // rotaciona diariamente
      path: logDir,
      maxFiles: 14,   // mantém 14 arquivos antigos
      compress: 'gzip',
      size: '10M'     // também rotaciona por tamanho
    });
    
    // Logger para arquivo com rotação
    const fileStream = pino(
      { level: 'warn' },
      rotatingStream
    );
    
    console.log(`✅ Rotação de logs ativada em: ${logDir}`);
    return fileStream;
    
  } catch (error) {
    console.warn(`⚠️ Erro na rotação de logs: ${error.message}`);
    console.warn('📝 Usando logger simplificado (sem rotação)');
    
    // Fallback: logger simples sem rotação
    return pino({ level: 'warn' });
  }
}

// Criar logger de arquivo
const fileStream = createFileLogger();

// Função para logs de debug (só em desenvolvimento)
function debug(message, ...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

module.exports = {
  fileLogger: fileStream,
  logger: consoleStream,
  debug
}; 