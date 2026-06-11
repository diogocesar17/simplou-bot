import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { captureException } from './sentry';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const RETENTION_DAYS = 30;
const BACKUP_HOUR = 3; // 3h no fuso do container (TZ=America/Sao_Paulo)
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let lastBackupDate = '';
let schedulerStarted = false;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHour(): number {
  return new Date().getHours();
}

function parseDbUrl(url: string): { host: string; port: string; database: string; user: string; password: string } | null {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.slice(1),
      user: u.username,
      password: u.password,
    };
  } catch {
    return null;
  }
}

function backupFilePath(encrypted: boolean): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ext = encrypted ? 'sql.gz.enc' : 'sql.gz';
  return path.join(BACKUP_DIR, `simplou_${ts}.${ext}`);
}

async function executarPgDump(): Promise<{ file: string; sizeKb: number; encrypted: boolean }> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL não configurada');

  const conn = parseDbUrl(dbUrl);
  if (!conn) throw new Error('DATABASE_URL em formato inválido');

  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  const encrypted = !!encryptionKey;

  if (!encrypted) {
    logger.warn('[BACKUP] BACKUP_ENCRYPTION_KEY não configurada — backup sem criptografia');
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const outPath = backupFilePath(encrypted);
  const outStream = fs.createWriteStream(outPath);

  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn('pg_dump', ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '--no-password'], {
      env: { ...process.env, PGPASSWORD: conn.password },
    });

    const gzip = spawn('gzip', ['-c']);

    let pgStderr = '';
    pgDump.stderr.on('data', (d: Buffer) => { pgStderr += d.toString(); });

    pgDump.on('error', (e) => reject(new Error(`pg_dump não encontrado: ${e.message} — instale postgresql-client`)));
    gzip.on('error', reject);

    pgDump.on('close', (code) => {
      if (code !== 0) reject(new Error(`pg_dump falhou (código ${code}): ${pgStderr.trim()}`));
    });

    if (encrypted) {
      // Pipeline: pg_dump | gzip | openssl enc -aes-256-cbc -pbkdf2
      const openssl = spawn('openssl', ['enc', '-aes-256-cbc', '-pbkdf2', '-pass', `pass:${encryptionKey}`]);

      pgDump.stdout.pipe(gzip.stdin);
      gzip.stdout.pipe(openssl.stdin);
      openssl.stdout.pipe(outStream);

      openssl.on('error', reject);
      openssl.on('close', (code) => {
        if (code !== 0) reject(new Error(`openssl falhou com código ${code}`));
        else resolve();
      });
    } else {
      // Pipeline sem criptografia: pg_dump | gzip
      pgDump.stdout.pipe(gzip.stdin);
      gzip.stdout.pipe(outStream);

      gzip.on('close', (code) => {
        if (code !== 0) reject(new Error(`gzip falhou com código ${code}`));
        else resolve();
      });
    }
  });

  const stat = fs.statSync(outPath);
  return { file: path.basename(outPath), sizeKb: Math.round(stat.size / 1024), encrypted };
}

function removerBackupsAntigos(): number {
  let removed = 0;
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^simplou_\d{8}_\d{6}\.sql\.gz(\.enc)?$/.test(f));
    for (const f of files) {
      const fullPath = path.join(BACKUP_DIR, f);
      if (fs.statSync(fullPath).mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }
  } catch {
    // não fatal
  }
  return removed;
}

export async function runBackupNow(): Promise<{ ok: boolean; file?: string; sizeKb?: number; totalArquivos?: number; encrypted?: boolean; error?: string }> {
  try {
    logger.info('[BACKUP] Iniciando pg_dump');
    const { file, sizeKb, encrypted } = await executarPgDump();
    const removed = removerBackupsAntigos();
    const totalArquivos = fs.readdirSync(BACKUP_DIR).filter((f) => /\.sql\.gz(\.enc)?$/.test(f)).length;
    lastBackupDate = today();
    logger.info({ file, sizeKb, encrypted, removed, totalArquivos }, '[BACKUP] Backup concluído');
    return { ok: true, file, sizeKb, totalArquivos, encrypted };
  } catch (err: any) {
    const error = err?.message || String(err);
    logger.error({ err: error }, '[BACKUP] Falha no backup automático');
    captureException(err, { context: 'backup-scheduler' });
    return { ok: false, error };
  }
}

export function iniciarBackupScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  logger.info('[BACKUP] Scheduler iniciado — pg_dump diário às 03h, retenção 30 dias');

  setInterval(async () => {
    if (currentHour() !== BACKUP_HOUR) return;
    if (lastBackupDate === today()) return;
    await runBackupNow();
  }, CHECK_INTERVAL_MS);
}
