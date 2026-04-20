import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true' ||
  Boolean(process.env.FLY_APP_NAME) ||
  Boolean(process.env.DYNO);

function clampProdLevel(desired: string): string {
  const values = pino.levels.values as Record<string, number>;
  const desiredValue = values[desired] ?? values.warn;
  const warnValue = values.warn;
  if (desiredValue < warnValue) return 'warn';
  return desired;
}

const level = isProd ? clampProdLevel(process.env.LOG_LEVEL || 'warn') : (process.env.LOG_LEVEL || 'debug');

// Logger para console (colorido, legível)
const consoleStream = pino(
  { level },
  pino.transport({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' }
  })
);

// Função para criar logger de arquivo com rotação
function createFileLogger(): any {
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
    } catch (error: any) {
      throw new Error(`Sem permissão de escrita no diretório: ${logDir}`);
    }
    // Tentar importar rotating-file-stream
    let rfs: any;
    try {
      rfs = require('rotating-file-stream');
    } catch (error: any) {
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
  } catch (error: any) {
    console.warn(`⚠️ Erro na rotação de logs: ${error.message}`);
    console.warn('📝 Usando logger simplificado (sem rotação)');
    // Fallback: logger simples sem rotação
    return pino({ level: 'warn' });
  }
}

// Criar logger de arquivo
const fileStream = createFileLogger();

// Função para logs de debug (só em desenvolvimento)
function debug(message: string, ...args: any[]): void {
  if (process.env.DEBUG_MESSAGES === 'true') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

export { fileStream as fileLogger, consoleStream as logger, debug }; 
