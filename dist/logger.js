"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.fileLogger = void 0;
exports.debug = debug;
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Configuração do nível de log para o console
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
// Logger para console (colorido, legível)
const consoleStream = (0, pino_1.default)({ level }, pino_1.default.transport({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' }
}));
exports.logger = consoleStream;
// Função para criar logger de arquivo com rotação
function createFileLogger() {
    try {
        // Determinar diretório de logs
        const logDir = process.env.NODE_ENV === 'production' ? '/app/logs' : path_1.default.join(__dirname, 'logs');
        // Criar diretório se não existir
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
            console.log(`📁 Diretório de logs criado: ${logDir}`);
        }
        // Verificar permissões de escrita
        try {
            fs_1.default.accessSync(logDir, fs_1.default.constants.W_OK);
        }
        catch (error) {
            throw new Error(`Sem permissão de escrita no diretório: ${logDir}`);
        }
        // Tentar importar rotating-file-stream
        let rfs;
        try {
            rfs = require('rotating-file-stream');
        }
        catch (error) {
            throw new Error('Pacote rotating-file-stream não disponível');
        }
        // Criar stream rotativo
        const rotatingStream = rfs.createStream('app.log', {
            interval: '1d', // rotaciona diariamente
            path: logDir,
            maxFiles: 14, // mantém 14 arquivos antigos
            compress: 'gzip',
            size: '10M' // também rotaciona por tamanho
        });
        // Logger para arquivo com rotação
        const fileStream = (0, pino_1.default)({ level: 'warn' }, rotatingStream);
        console.log(`✅ Rotação de logs ativada em: ${logDir}`);
        return fileStream;
    }
    catch (error) {
        console.warn(`⚠️ Erro na rotação de logs: ${error.message}`);
        console.warn('📝 Usando logger simplificado (sem rotação)');
        // Fallback: logger simples sem rotação
        return (0, pino_1.default)({ level: 'warn' });
    }
}
// Criar logger de arquivo
const fileStream = createFileLogger();
exports.fileLogger = fileStream;
// Função para logs de debug (só em desenvolvimento)
function debug(message, ...args) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] ${message}`, ...args);
    }
}
//# sourceMappingURL=logger.js.map