#!/bin/bash
# Backup automático do PostgreSQL com upload para Cloudflare R2
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

# ── Upload para Cloudflare R2 ─────────────────────────────────────────────────
# Requer no .env:
#   CLOUDFLARE_ACCOUNT_ID=<seu account id>
#   R2_ACCESS_KEY_ID=<access key gerado no R2>
#   R2_SECRET_ACCESS_KEY=<secret key gerado no R2>
#   R2_BUCKET_NAME=simplou-backups
#   R2_PREFIX=db  (opcional, default: db)
#
# Requer awscli instalado no host: apt install awscli -y

R2_PREFIX="${R2_PREFIX:-db}"

if [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && \
   [ -n "${R2_ACCESS_KEY_ID:-}" ] && \
   [ -n "${R2_SECRET_ACCESS_KEY:-}" ] && \
   [ -n "${R2_BUCKET_NAME:-}" ]; then

  R2_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
  R2_KEY="${R2_PREFIX}/$(basename "$BACKUP_FILE")"

  log "Enviando backup para R2 → s3://${R2_BUCKET_NAME}/${R2_KEY}"

  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 cp "$BACKUP_FILE" "s3://${R2_BUCKET_NAME}/${R2_KEY}" \
    --endpoint-url "$R2_ENDPOINT" \
    --region auto \
    --no-progress \
    2>&1 | tee -a "$LOG_FILE" \
    && log "Upload R2 concluído ✓" \
    || log "AVISO: upload R2 falhou — backup local mantido"

else
  log "AVISO: variáveis R2 não configuradas — upload offsite ignorado"
  log "  Defina CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME no .env"
fi

# ── Remover backups locais antigos ────────────────────────────────────────────
REMOVIDOS=$(find "$BACKUP_DIR" \( -name "simplou_*.sql.gz" -o -name "simplou_*.sql.gz.enc" \) -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [ "$REMOVIDOS" -gt 0 ]; then
  log "Removidos $REMOVIDOS backup(s) local(is) com mais de $RETENTION_DAYS dias"
fi

# ── Listar backups locais existentes ──────────────────────────────────────────
TOTAL=$(find "$BACKUP_DIR" \( -name "simplou_*.sql.gz" -o -name "simplou_*.sql.gz.enc" \) | wc -l)
log "Total de backups locais armazenados: $TOTAL"
log "─────────────────────────────────────"
