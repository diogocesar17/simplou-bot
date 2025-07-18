const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Diretório de logs
const logDir = process.env.NODE_ENV === 'production' ? '/app/logs' : path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Caminho do arquivo de log
const logFile = path.join(logDir, 'app.log');

// Configuração do nível de log para o console
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Logger para arquivo: apenas warn e error
const fileStream = pino(
  { level: 'warn' },
  pino.destination({ dest: logFile, sync: false })
);

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
 * Recomenda-se usar logrotate no sistema operacional para rotacionar o arquivo logs/app.log.
 * Exemplo de configuração logrotate:
 *
 * /app/logs/app.log {
 *   daily
 *   rotate 14
 *   compress
 *   missingok
 *   notifempty
 *   copytruncate
 * }
 *
 * Para ambiente local, ajuste o caminho para ./logs/app.log
 */ 