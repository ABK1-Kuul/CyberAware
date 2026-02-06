#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_DATABASE="${MYSQL_DATABASE:-cyberaware}"
MYSQL_USER="${MYSQL_USER:-cyberaware}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-change-me}"
GOPHISH_DATA_DIR="${GOPHISH_DATA_DIR:-./gophish}"
S3_URI="${BACKUP_S3_URI:-}"
S3_SSE="${S3_SSE:-AES256}"

mkdir -p "$BACKUP_DIR"

MYSQL_DUMP_FILE="$BACKUP_DIR/mysql-${MYSQL_DATABASE}-${TIMESTAMP}.sql"
GOPHISH_ARCHIVE="$BACKUP_DIR/gophish-${TIMESTAMP}.tar.gz"

echo "Dumping MySQL database..."
mysqldump \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --password="$MYSQL_PASSWORD" \
  "$MYSQL_DATABASE" > "$MYSQL_DUMP_FILE"

echo "Archiving GoPhish config/data..."
tar -czf "$GOPHISH_ARCHIVE" -C "$GOPHISH_DATA_DIR" .

if [[ -n "$S3_URI" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "AWS CLI not available; skipping S3 upload."
    exit 1
  fi
  echo "Uploading backups to S3..."
  aws s3 cp "$MYSQL_DUMP_FILE" "$S3_URI/" --sse "$S3_SSE"
  aws s3 cp "$GOPHISH_ARCHIVE" "$S3_URI/" --sse "$S3_SSE"
  echo "Upload complete."
else
  echo "Backups stored locally at $BACKUP_DIR"
fi
