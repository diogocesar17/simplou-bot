const pino = require('pino');
const fs = require('fs');
const path = require('path');
const rfs = require('rotating-file-stream');

// Diretório de logs
const logDir = process.env.NODE_ENV === 'production' ? '/app/logs' : path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Stream rotativo para logs críticos
const rotatingStream = rfs.createStream('app.log', {
  interval: '1d', // rotaciona diariamente
  path: logDir,
  maxFiles: 14,   // mantém 14 arquivos antigos
  compress: 'gzip'
});

// Logger para arquivo: apenas warn e error
const fileStream = pino(
  { level: 'warn' },
  rotatingStream
);

// Configuração do nível de log para o console
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Logger para console (colorido, legível)
const consoleStream = pino(
  { level },
  pino.transport({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' }
  })
);

module.exports = {
  fileLogger: fileStream,
  logger: consoleStream,
};

/*
 * Rotação de logs:
 * Agora é feita automaticamente via rotating-file-stream.
 * - Rotação diária
 * - Mantém 14 arquivos antigos
 * - Logs antigos comprimidos (gzip)
 *
 * Para logs locais, os arquivos ficam em ./logs/app.log, ./logs/app.log.1.gz, etc.
 * Para produção (Docker), ficam em /app/logs/app.log, etc.
 */ 