#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_BASE="${APP_BASE:-/opt/kotoba}"

validate_app_base() {
  local candidate="$1"
  local effective_uid="${2:-$EUID}"
  if ! [[ "$candidate" =~ ^/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ ]]; then
    printf 'APP_BASE must be a canonical absolute path using only letters, digits, dot, underscore, dash, and slash\n' >&2
    return 1
  fi
  case "$candidate/" in
    *"/./"*|*"/../"*)
      printf 'APP_BASE must not contain dot path segments\n' >&2
      return 1
      ;;
  esac

  if [ "$effective_uid" -ne 0 ] &&
    [ "${NODE_ENV:-}" = "test" ] &&
    [ "${KOTOBA_TEST_ALLOW_NONSTANDARD_BASE:-0}" = "1" ]; then
    return 0
  fi

  if ! [[ "$candidate" =~ ^/(opt|srv)/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ ]]; then
    printf 'APP_BASE must be a dedicated canonical child below /opt or /srv\n' >&2
    return 1
  fi
}

validate_app_base "$APP_BASE" || exit 1
SHARED_DIR="$APP_BASE/shared"
CONFIG_DIR="$APP_BASE/config"
ENV_FILE="$CONFIG_DIR/kotoba.env"
DB_PATH="$SHARED_DIR/data/sqlite.db"
UPLOAD_DIR="$SHARED_DIR/uploads"
BACKUP_DIR="$APP_BASE/backups"
DEPLOY_LOCK_FILE="$APP_BASE/deploy.lock"
DATE=$(date +%Y%m%d_%H%M%S)
PENDING_DIR=""
BACKUP_ID=""
DB_NAME=""
ENV_NAME=""
UPLOAD_NAME=""
MANIFEST_NAME=""
DB_BACKUP=""
ENV_BACKUP=""
UPLOAD_BACKUP=""
MANIFEST=""
FINAL_DB_BACKUP=""
FINAL_ENV_BACKUP=""
FINAL_UPLOAD_BACKUP=""
FINAL_MANIFEST=""
BACKUP_LOCK_FILE="$BACKUP_DIR/.backup.lock"
HEALTH_URL="${KOTOBA_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SERVICE_WAS_ACTIVE=0
MAINTENANCE_WAS_PRESENT=0
EXPECTED_REVISION=""

run_root() {
  if [ "$EUID" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

health_response_is_ready() {
  local response="$1"
  KOTOBA_HEALTH_RESPONSE="$response" \
    KOTOBA_EXPECTED_REVISION="$EXPECTED_REVISION" \
    python3 - <<'PY'
import json
import os
import sys

try:
    payload = json.loads(os.environ["KOTOBA_HEALTH_RESPONSE"])
except (KeyError, json.JSONDecodeError, TypeError):
    raise SystemExit(1)

expected = os.environ.get("KOTOBA_EXPECTED_REVISION", "")
valid = (
    isinstance(payload, dict)
    and payload.get("success") is True
    and payload.get("status") == "ready"
    and payload.get("revision") == expected
)
raise SystemExit(0 if valid else 1)
PY
}

wait_for_health() {
  local response attempt
  [ -n "$EXPECTED_REVISION" ] || return 1
  for attempt in $(seq 1 20); do
    if response=$(curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" 2>/dev/null) &&
      health_response_is_ready "$response"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

resume_service() {
  [ "$SERVICE_WAS_ACTIVE" -eq 1 ] || return 0
  if ! run_root systemctl start kotoba || ! wait_for_health; then
    printf 'Kotoba could not be restored after backup; maintenance remains enabled\n' >&2
    return 1
  fi
  if [ "$MAINTENANCE_WAS_PRESENT" -eq 0 ]; then
    run_root rm -f -- "$APP_BASE/maintenance" || return 1
  fi
  SERVICE_WAS_ACTIVE=0
}

cleanup_on_exit() {
  local rc=$?
  local cleanup_rc=0
  trap - EXIT
  if [ -n "$PENDING_DIR" ] && [ -d "$PENDING_DIR" ]; then
    rm -rf -- "$PENDING_DIR" || cleanup_rc=1
  fi
  if [ "$SERVICE_WAS_ACTIVE" -eq 1 ]; then
    resume_service || cleanup_rc=1
  fi
  if [ "$rc" -eq 0 ] && [ "$cleanup_rc" -ne 0 ]; then
    rc="$cleanup_rc"
  fi
  exit "$rc"
}

service_activity() {
  local rc=0
  if ! command -v systemctl >/dev/null 2>&1; then
    if [ "$EUID" -ne 0 ] &&
      [ "${NODE_ENV:-}" = "test" ] &&
      [ "${KOTOBA_TEST_ALLOW_NONSTANDARD_BASE:-0}" = "1" ]; then
      printf 'inactive\n'
      return 0
    fi
    printf 'systemctl is required for root-operated backups\n' >&2
    return 1
  fi

  run_root systemctl is-active --quiet kotoba || rc=$?
  case "$rc" in
    0) printf 'active\n' ;;
    3) printf 'inactive\n' ;;
    *)
      printf 'Could not determine whether kotoba is active (systemctl rc=%s)\n' "$rc" >&2
      return 1
      ;;
  esac
}

if [ "${KOTOBA_DEPLOY_LOCK_HELD:-0}" != "1" ]; then
  touch "$DEPLOY_LOCK_FILE" || exit 1
  exec 7>"$DEPLOY_LOCK_FILE"
  flock -s -n 7 || {
    printf 'A Kotoba deployment or restore is running\n' >&2
    exit 1
  }
fi

[ -L "$BACKUP_DIR" ] && {
  printf 'Backup directory must not be a symbolic link\n' >&2
  exit 1
}
mkdir -p "$BACKUP_DIR" || exit 1
[ -L "$BACKUP_DIR" ] && {
  printf 'Backup directory became a symbolic link during preparation\n' >&2
  exit 1
}
chmod 0700 "$BACKUP_DIR" || exit 1

exec 8>"$BACKUP_LOCK_FILE"
flock -n 8 || {
  printf 'Another Kotoba backup is already running\n' >&2
  exit 1
}
trap cleanup_on_exit EXIT
PENDING_DIR=$(mktemp -d "$BACKUP_DIR/.pending-${DATE}-XXXXXX") || exit 1
chmod 0700 "$PENDING_DIR" || exit 1
BACKUP_ID=${PENDING_DIR##*/}
BACKUP_ID=${BACKUP_ID#.pending-}
DB_NAME="sqlite_$BACKUP_ID.db"
ENV_NAME="env_$BACKUP_ID"
UPLOAD_NAME="uploads_$BACKUP_ID.tar.gz"
MANIFEST_NAME="manifest_$BACKUP_ID.sha256"
DB_BACKUP="$PENDING_DIR/$DB_NAME"
ENV_BACKUP="$PENDING_DIR/$ENV_NAME"
UPLOAD_BACKUP="$PENDING_DIR/$UPLOAD_NAME"
MANIFEST="$PENDING_DIR/$MANIFEST_NAME"
FINAL_DB_BACKUP="$BACKUP_DIR/$DB_NAME"
FINAL_ENV_BACKUP="$BACKUP_DIR/$ENV_NAME"
FINAL_UPLOAD_BACKUP="$BACKUP_DIR/$UPLOAD_NAME"
FINAL_MANIFEST="$BACKUP_DIR/$MANIFEST_NAME"

[ -f "$DB_PATH" ] || {
  printf 'Database does not exist: %s\n' "$DB_PATH" >&2
  exit 1
}
[ -f "$ENV_FILE" ] || {
  printf 'Environment file does not exist: %s\n' "$ENV_FILE" >&2
  exit 1
}
[ -d "$UPLOAD_DIR" ] || {
  printf 'Upload directory does not exist: %s\n' "$UPLOAD_DIR" >&2
  exit 1
}

# A DB snapshot and its referenced uploads are one recovery unit. Scheduled or
# manual backups therefore pause writes for the whole snapshot window. Deploys
# already hold the exclusive operation lock and stop the service themselves.
activity=$(service_activity) || exit 1
if [ "$activity" = "active" ]; then
  revision_file="$APP_BASE/current/.release-revision"
  [ -f "$revision_file" ] || {
    printf 'Active release revision is missing: %s\n' "$revision_file" >&2
    exit 1
  }
  EXPECTED_REVISION=$(tr -d '\r\n' < "$revision_file") || exit 1
  [[ "$EXPECTED_REVISION" =~ ^[0-9a-f]{40}$ ]] || {
    printf 'Active release revision is invalid\n' >&2
    exit 1
  }
  if run_root test -L "$APP_BASE/maintenance"; then
    printf 'Maintenance marker must not be a symbolic link\n' >&2
    exit 1
  fi
  if run_root test -e "$APP_BASE/maintenance"; then
    run_root test -f "$APP_BASE/maintenance" || {
      printf 'Maintenance marker must be a regular file\n' >&2
      exit 1
    }
    MAINTENANCE_WAS_PRESENT=1
    SERVICE_WAS_ACTIVE=1
  else
    run_root sh -c 'set -C; : > "$1"' sh "$APP_BASE/maintenance" || exit 1
    SERVICE_WAS_ACTIVE=1
    run_root chmod 0644 "$APP_BASE/maintenance" || exit 1
  fi
  stop_rc=0
  run_root systemctl stop kotoba || stop_rc=$?
  activity=$(service_activity) || exit 1
  if [ "$activity" != "inactive" ]; then
    printf 'Kotoba still reports active after stop; backup aborted\n' >&2
    exit 1
  fi
  if [ "$stop_rc" -ne 0 ]; then
    printf 'systemctl stop returned %s, but kotoba is confirmed inactive; continuing\n' "$stop_rc" >&2
  fi
fi

[ "$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;")" = "ok" ] || {
  printf 'Source database failed PRAGMA integrity_check\n' >&2
  exit 1
}
sqlite3 "$DB_PATH" ".backup '$DB_BACKUP'" || exit 1
[ -f "$DB_BACKUP" ] || exit 1
[ "$(sqlite3 "$DB_BACKUP" "PRAGMA integrity_check;")" = "ok" ] || {
  printf 'Backup database failed PRAGMA integrity_check\n' >&2
  exit 1
}

cp "$ENV_FILE" "$ENV_BACKUP" || exit 1
chmod 0600 "$ENV_BACKUP" || exit 1

tar -czf "$UPLOAD_BACKUP" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")" || exit 1

(
  cd "$PENDING_DIR" || exit 1
  files=("$(basename "$DB_BACKUP")" "$(basename "$ENV_BACKUP")" "$(basename "$UPLOAD_BACKUP")")
  sha256sum "${files[@]}" > "$(basename "$MANIFEST")"
) || exit 1

for final_path in "$FINAL_DB_BACKUP" "$FINAL_ENV_BACKUP" "$FINAL_UPLOAD_BACKUP" "$FINAL_MANIFEST"; do
  if [ -e "$final_path" ] || [ -L "$final_path" ]; then
    printf 'Refusing to overwrite an existing backup-set path: %s\n' "$final_path" >&2
    exit 1
  fi
done

mv -n -- "$DB_BACKUP" "$FINAL_DB_BACKUP" || exit 1
[ ! -e "$DB_BACKUP" ] || {
  printf 'Backup-set collision while publishing %s\n' "$FINAL_DB_BACKUP" >&2
  exit 1
}
mv -n -- "$ENV_BACKUP" "$FINAL_ENV_BACKUP" || exit 1
[ ! -e "$ENV_BACKUP" ] || {
  printf 'Backup-set collision while publishing %s\n' "$FINAL_ENV_BACKUP" >&2
  exit 1
}
mv -n -- "$UPLOAD_BACKUP" "$FINAL_UPLOAD_BACKUP" || exit 1
[ ! -e "$UPLOAD_BACKUP" ] || {
  printf 'Backup-set collision while publishing %s\n' "$FINAL_UPLOAD_BACKUP" >&2
  exit 1
}
# The manifest is moved last and acts as the COMPLETE marker for this backup set.
mv -n -- "$MANIFEST" "$FINAL_MANIFEST" || exit 1
[ ! -e "$MANIFEST" ] || {
  printf 'Backup-set collision while publishing %s\n' "$FINAL_MANIFEST" >&2
  exit 1
}

# Remove the COMPLETE marker before any expired payload, so readers never see a
# manifest for a set whose files are being retired.
find "$BACKUP_DIR" -maxdepth 1 -name 'manifest_*.sha256' -type f -mtime +14 -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'sqlite_*.db' -type f -mtime +14 -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'env_*' -type f -mtime +14 -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads_*.tar.gz' -type f -mtime +14 -delete

resume_service
rm -rf -- "$PENDING_DIR"
PENDING_DIR=""
trap - EXIT
printf '%s\n' "$FINAL_DB_BACKUP"
