#!/bin/bash
# 每日备份 sqlite.db 到 backups/ 目录
BACKUP_DIR="/opt/kotoba/backups"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)
cp /opt/kotoba/sqlite.db "$BACKUP_DIR/sqlite_$DATE.db"
# 保留最近 7 份备份
ls -t "$BACKUP_DIR"/sqlite_*.db | tail -n +8 | xargs -r rm
