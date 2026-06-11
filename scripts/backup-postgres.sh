#!/bin/bash
# Backup automático do PostgreSQL — roda via cron no host do Hetzner
# Cron sugerido (3h da manhã, todo dia): 0 3 * * * /opt/simplou/scripts/backup-postgres.sh

set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=30
CONTAINER="simplou-postgres"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$BACKUP_DIR/backup.log"

# ── Carregar variáveis do .env ────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "[BACKUP] ERRO: .env não encontrado em $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── Verificar variáveis obrigatórias ─────────────────────────────────────────
: "${POSTGRES_DB:?POSTGRES_DB não definido no .env}"
: "${POSTGRES_USER:?POSTGRES_USER não definido no .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não definido no .env}"

# ── Criar diretório de backups ────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── Verificar se o container está rodando ─────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  log "ERRO: container '$CONTAINER' não está rodando"
  exit 1
fi

# ── Executar pg_dump com ou sem criptografia ──────────────────────────────────
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  BACKUP_FILE="$BACKUP_DIR/simplou_${TIMESTAMP}.sql.gz.enc"
  log "Iniciando backup (AES-256 criptografado) → $BACKUP_FILE"

  PGPASSWORD="$POSTGRES_PASSWORD" docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" \
    "$CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-password \
    | gzip \
    | openssl enc -aes-256-cbc -pbkdf2 -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
    > "$BACKUP_FILE"

  log "Backup criptografado concluído — tamanho: $(du -sh "$BACKUP_FILE" | cut -f1)"
  log "Para restaurar: openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:\$BACKUP_ENCRYPTION_KEY -in $BACKUP_FILE | gunzip | psql ..."
else
  BACKUP_FILE="$BACKUP_DIR/simplou_${TIMESTAMP}.sql.gz"
  log "AVISO: BACKUP_ENCRYPTION_KEY não configurada — backup sem criptografia"
  log "Iniciando backup → $BACKUP_FILE"

  PGPASSWORD="$POSTGRES_PASSWORD" docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" \
    "$CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-password \
    | gzip > "$BACKUP_FILE"

  log "Backup concluído — tamanho: $(du -sh "$BACKUP_FILE" | cut -f1)"
fi

# ── Remover backups antigos ───────────────────────────────────────────────────
REMOVIDOS=$(find "$BACKUP_DIR" \( -name "simplou_*.sql.gz" -o -name "simplou_*.sql.gz.enc" \) -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [ "$REMOVIDOS" -gt 0 ]; then
  log "Removidos $REMOVIDOS backup(s) com mais de $RETENTION_DAYS dias"
fi

# ── Listar backups existentes ─────────────────────────────────────────────────
TOTAL=$(find "$BACKUP_DIR" \( -name "simplou_*.sql.gz" -o -name "simplou_*.sql.gz.enc" \) | wc -l)
log "Total de backups armazenados: $TOTAL"
log "─────────────────────────────────────"
