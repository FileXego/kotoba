#!/usr/bin/env bash
set -euo pipefail

SHARED_DIR="${KOTOBA_SHARED_DIR:-/opt/kotoba/shared}"
DB_PATH="${DB_PATH:-$SHARED_DIR/sqlite.db}"
UPLOAD_DIR="${UPLOAD_DIR:-$SHARED_DIR/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$SHARED_DIR/backups}"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/sqlite_$DATE.db'"

if [ -d "$UPLOAD_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

find "$BACKUP_DIR" -name 'sqlite_*.db' -type f -mtime +14 -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -type f -mtime +14 -delete
