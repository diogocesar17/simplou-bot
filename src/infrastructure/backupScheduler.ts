import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { captureException } from './sentry';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const RETENTION_DAYS = 30;
const BACKUP_HOUR = 3; // 3h no fuso do container (TZ=America/Sao_Paulo)
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // verifica a cada hora

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

function backupFilePath(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return path.join(BACKUP_DIR, `simplou_${ts}.sql.gz`);
}

async function executarPgDump(): Promise<{ file: string; sizeKb: number }> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL não configurada');

  const conn = parseDbUrl(dbUrl);
  if (!conn) throw new Error('DATABASE_URL em formato inválido');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const outPath = backupFilePath();
  const outStream = fs.createWriteStream(outPath);

  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn('pg_dump', ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '--no-password'], {
      env: { ...process.env, PGPASSWORD: conn.password },
    });

    const gzip = spawn('gzip', ['-c']);
    pgDump.stdout.pipe(gzip.stdin);
    gzip.stdout.pipe(outStream);

    let pgStderr = '';
    pgDump.stderr.on('data', (d: Buffer) => { pgStderr += d.toString(); });

    pgDump.on('error', (e) => reject(new Error(`pg_dump não encontrado: ${e.message} — instale postgresql-client`)));
    gzip.on('error', reject);

    pgDump.on('close', (code) => {
      if (code !== 0) reject(new Error(`pg_dump falhou (código ${code}): ${pgStderr.trim()}`));
    });

    gzip.on('close', (code) => {
      if (code !== 0) reject(new Error(`gzip falhou com código ${code}`));
      else resolve();
    });
  });

  const stat = fs.statSync(outPath);
  return { file: path.basename(outPath), sizeKb: Math.round(stat.size / 1024) };
}

function removerBackupsAntigos(): number {
  let removed = 0;
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^simplou_\d{8}_\d{6}\.sql\.gz$/.test(f));
    for (const f of files) {
      const fullPath = path.join(BACKUP_DIR, f);
      if (fs.statSync(fullPath).mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }
  } catch {
    // não fatal — só loga se tiver o diretório
  }
  return removed;
}

export async function runBackupNow(): Promise<{ ok: boolean; file?: string; sizeKb?: number; totalArquivos?: number; error?: string }> {
  try {
    logger.info('[BACKUP] Iniciando pg_dump');
    const { file, sizeKb } = await executarPgDump();
    const removed = removerBackupsAntigos();
    const totalArquivos = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql.gz')).length;
    lastBackupDate = today();
    logger.info({ file, sizeKb, removed, totalArquivos }, '[BACKUP] Backup concluído');
    return { ok: true, file, sizeKb, totalArquivos };
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
