#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# deploy.sh intentionally keeps all reusable functions above its case statement.
# The bootstrap is run from a separately verified v2.1.2 checkout, never through
# the v2.1.1 current symlink.
source <(sed '/^case "\${1:-}" in/,$d' "$SCRIPT_DIR/deploy.sh")

LEGACY_ENV="$SHARED_DIR/.env"
LEGACY_DB="$SHARED_DIR/sqlite.db"
LEGACY_RELEASE=""
LEGACY_RESCUE=""
LEGACY_DB_BACKUP=""
LEGACY_STOPPED=0
BOOTSTRAP_COMPLETE=0
FAILED_RELEASE=""
CRONTABS_TOUCHED=0
MAINTENANCE_CREATED=0
NEW_DB_CREATED=0
NEW_ENV_CREATED=0
STAMP=$(date -u +%Y%m%d_%H%M%S)
USER_CRON_TMP=""
ROOT_CRON_TMP=""

require_legacy_installation() {
  [ -L "$CURRENT_LINK" ] || die "No v2.1.1 current symlink was found. Use deploy.sh init for a new installation."
  LEGACY_RELEASE=$(readlink -f "$CURRENT_LINK") || return 1
  case "$LEGACY_RELEASE" in
    "$RELEASES_DIR"/kotoba-*) ;;
    *) die "Current release is outside the managed releases directory." ;;
  esac
  [ -f "$LEGACY_ENV" ] || die "Legacy environment file is missing: $LEGACY_ENV"
  [ -f "$LEGACY_DB" ] || die "Legacy database is missing: $LEGACY_DB"
  [ -d "$UPLOAD_DIR" ] || die "Legacy uploads directory is missing: $UPLOAD_DIR"
  [ -f /etc/systemd/system/kotoba.service ] || die "Legacy systemd unit is missing."
  sudo grep -Fq "EnvironmentFile=$LEGACY_ENV" /etc/systemd/system/kotoba.service ||
    die "The active service is not the supported v2.1.1 topology."
  { [ ! -e "$ENV_FILE" ] && [ ! -L "$ENV_FILE" ]; } ||
    die "New topology already exists at $ENV_FILE; do not rerun the bootstrap."
  { [ ! -e "$DB_PATH" ] && [ ! -L "$DB_PATH" ]; } ||
    die "New topology already exists at $DB_PATH; do not rerun the bootstrap."
}

capture_and_disable_legacy_crontabs() {
  local pgrep_rc=0
  command -v crontab >/dev/null 2>&1 || {
    log "crontab is required to safely suspend the legacy backup schedule."
    return 1
  }
  command -v pgrep >/dev/null 2>&1 || {
    log "pgrep (procps) is required to prove no legacy backup is running."
    return 1
  }
  USER_CRON_TMP=$(mktemp) || return 1
  ROOT_CRON_TMP=$(mktemp) || {
    rm -f -- "$USER_CRON_TMP"
    USER_CRON_TMP=""
    return 1
  }
  read_crontab_snapshot user "$USER_CRON_TMP" || return 1
  read_crontab_snapshot root "$ROOT_CRON_TMP" || return 1

  CRONTABS_TOUCHED=1
  awk -v target="$CURRENT_LINK/future/backup.sh" 'index($0, target) == 0' "$USER_CRON_TMP" |
    crontab - || return 1
  awk -v target="$CURRENT_LINK/future/backup.sh" 'index($0, target) == 0' "$ROOT_CRON_TMP" |
    sudo crontab - || return 1

  pgrep -f "$APP_BASE/current/future/backup\.sh" >/dev/null 2>&1 || pgrep_rc=$?
  case "$pgrep_rc" in
    0)
      log "A legacy backup is already running. Wait for it to finish, then rerun."
      return 1
      ;;
    1) ;;
    *)
      log "Could not inspect legacy backup processes (pgrep rc=$pgrep_rc)."
      return 1
      ;;
  esac
}

read_crontab_snapshot() {
  local owner="$1"
  local destination="$2"
  local error_file="${destination}.error"
  local rc=0
  if [ "$owner" = "root" ]; then
    LC_ALL=C sudo crontab -l > "$destination" 2> "$error_file" || rc=$?
  else
    LC_ALL=C crontab -l > "$destination" 2> "$error_file" || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    if grep -Eiq '^no crontab for [^[:space:]]+[.!]?$' "$error_file"; then
      : > "$destination"
    else
      cat "$error_file" >&2
      rm -f -- "$error_file"
      return "$rc"
    fi
  fi
  rm -f -- "$error_file"
}

install_bootstrap_backup_schedule() {
  local current_root schedule_tmp rc=0
  current_root=$(mktemp) || return 1
  schedule_tmp=$(mktemp) || {
    rm -f -- "$current_root"
    return 1
  }
  if ! read_crontab_snapshot root "$current_root"; then
    rm -f -- "$current_root" "$schedule_tmp"
    return 1
  fi
  if ! awk -v target="$CURRENT_LINK/future/backup.sh" \
    'index($0, target) == 0' "$current_root" > "$schedule_tmp"; then
    rm -f -- "$current_root" "$schedule_tmp"
    return 1
  fi
  printf '0 3 * * * env APP_BASE=%s bash %s/future/backup.sh\n' \
    "$APP_BASE" "$CURRENT_LINK" >> "$schedule_tmp" || rc=1
  if [ "$rc" -eq 0 ]; then
    sudo crontab "$schedule_tmp" || rc=$?
  fi
  rm -f -- "$current_root" "$schedule_tmp" || {
    [ "$rc" -ne 0 ] || rc=1
  }
  return "$rc"
}

restore_legacy_crontabs() {
  local rc=0
  [ "$CRONTABS_TOUCHED" -eq 1 ] || return 0
  [ -f "$USER_CRON_TMP" ] || return 1
  [ -f "$ROOT_CRON_TMP" ] || return 1
  crontab "$USER_CRON_TMP" || rc=1
  sudo crontab "$ROOT_CRON_TMP" || rc=1
  if [ "$rc" -eq 0 ]; then
    CRONTABS_TOUCHED=0
  fi
  return "$rc"
}

stop_and_prove_service_inactive() {
  local stop_rc=0
  local state_rc=0
  sudo systemctl stop kotoba || stop_rc=$?
  sudo systemctl is-active --quiet kotoba || state_rc=$?
  case "$state_rc" in
    3)
      LEGACY_STOPPED=1
      if [ "$stop_rc" -ne 0 ]; then
        log "systemctl stop returned $stop_rc, but kotoba is confirmed inactive; continuing."
      fi
      return 0
      ;;
    0)
      log "Kotoba still reports active after stop."
      ;;
    *)
      log "Could not prove kotoba inactive after stop (systemctl rc=$state_rc)."
      ;;
  esac
  return 1
}

snapshot_legacy_installation() {
  local nginx_snapshot=0
  local files
  LEGACY_RESCUE=$(sudo mktemp -d "$BACKUP_DIR/bootstrap-v2.1.1-${STAMP}-XXXXXX") || return 1
  LEGACY_DB_BACKUP="$LEGACY_RESCUE/sqlite.db"
  sudo chown root:root "$LEGACY_RESCUE" || return 1
  sudo chmod 0700 "$LEGACY_RESCUE" || return 1

  [ "$(sudo sqlite3 "$LEGACY_DB" "PRAGMA integrity_check;")" = "ok" ] || return 1
  sudo sqlite3 "$LEGACY_DB" ".backup '$LEGACY_DB_BACKUP'" || return 1
  [ "$(sudo sqlite3 "$LEGACY_DB_BACKUP" "PRAGMA integrity_check;")" = "ok" ] || return 1
  sudo cp "$LEGACY_ENV" "$LEGACY_RESCUE/kotoba.env" || return 1
  sudo tar -czf "$LEGACY_RESCUE/uploads.tar.gz" \
    -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")" || return 1
  sudo cp /etc/systemd/system/kotoba.service "$LEGACY_RESCUE/kotoba.service" || return 1
  if sudo test -f "$NGINX_SITE_FILE"; then
    sudo cp "$NGINX_SITE_FILE" "$LEGACY_RESCUE/nginx.conf" || return 1
    nginx_snapshot=1
  fi
  sudo cp "$USER_CRON_TMP" "$LEGACY_RESCUE/deploy-user.crontab" || return 1
  sudo cp "$ROOT_CRON_TMP" "$LEGACY_RESCUE/root.crontab" || return 1
  printf '%s\n' "$LEGACY_RELEASE" | sudo tee "$LEGACY_RESCUE/release-path" >/dev/null || return 1
  files=(sqlite.db kotoba.env uploads.tar.gz kotoba.service deploy-user.crontab root.crontab release-path)
  [ "$nginx_snapshot" -eq 0 ] || files+=(nginx.conf)
  sudo sh -c '
    set -eu
    rescue=$1
    shift
    cd -- "$rescue"
    sha256sum -- "$@" > manifest.sha256
    sha256sum --check manifest.sha256 >/dev/null
  ' sh "$LEGACY_RESCUE" "${files[@]}" || return 1
}

seed_new_topology() {
  sudo install -m 0640 "$LEGACY_DB_BACKUP" "$DB_PATH" || return 1
  NEW_DB_CREATED=1
  sudo chown kotoba:kotoba "$DB_PATH" || return 1
  sudo cp "$LEGACY_ENV" "$ENV_FILE" || return 1
  NEW_ENV_CREATED=1
  sudo sed -i \
    -e '/^KOTOBA_REVISION=/d' \
    -e '/^TEST_DB=/d' \
    "$ENV_FILE" || return 1
  upsert_env DB_PATH "$DB_PATH"
  upsert_env UPLOAD_DIR "$UPLOAD_DIR"
  upsert_env NODE_ENV "production"
  upsert_env HOST "127.0.0.1"
  upsert_env PORT "3000"
  if [ -z "$(env_value UPLOAD_MAX_BYTES)" ]; then
    upsert_env UPLOAD_MAX_BYTES "5368709120"
  fi
  if [ -z "$(env_value VITE_MOBILE_ROUTES_ENABLED)" ]; then
    upsert_env VITE_MOBILE_ROUTES_ENABLED "true"
  fi
  sudo chown root:kotoba "$ENV_FILE" || return 1
  sudo chmod 0640 "$ENV_FILE" || return 1
  validate_env_file
}

cleanup_failed_new_topology() {
  local rc=0
  if [ "$NEW_DB_CREATED" -eq 1 ]; then
    sudo rm -f -- "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm" || rc=1
    [ "$rc" -ne 0 ] || NEW_DB_CREATED=0
  fi
  if [ "$NEW_ENV_CREATED" -eq 1 ]; then
    sudo rm -f -- "$ENV_FILE" || rc=1
    [ "$rc" -ne 0 ] || NEW_ENV_CREATED=0
  fi
  return "$rc"
}

legacy_health_response_is_ready() {
  local response="$1"
  KOTOBA_LEGACY_HEALTH_RESPONSE="$response" python3 - <<'PY'
import json
import os

try:
    payload = json.loads(os.environ["KOTOBA_LEGACY_HEALTH_RESPONSE"])
except (KeyError, json.JSONDecodeError, TypeError):
    raise SystemExit(1)

valid = (
    isinstance(payload, dict)
    and payload.get("success") is True
    and payload.get("version") == "2.1.0"
)
raise SystemExit(0 if valid else 1)
PY
}

wait_for_legacy_health() {
  local attempt response
  for attempt in $(seq 1 20); do
    if response=$(curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" 2>/dev/null) &&
      legacy_health_response_is_ready "$response" &&
      curl --fail --silent --show-error --max-time 5 --output /dev/null "$ROOT_URL"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

require_legacy_service_ready() {
  local state_rc=0
  sudo systemctl is-active --quiet kotoba || state_rc=$?
  [ "$state_rc" -eq 0 ] || {
    log "Legacy kotoba service must be active before bootstrapping (systemctl rc=$state_rc)."
    return 1
  }
  wait_for_legacy_health || {
    log "Legacy v2.1.1 health/root checks failed before bootstrapping."
    return 1
  }
}

enter_bootstrap_maintenance() {
  if sudo test -L "$APP_BASE/maintenance"; then
    log "Maintenance marker must not be a symbolic link."
    return 1
  fi
  sudo test ! -e "$APP_BASE/maintenance" || {
    log "Maintenance mode is already enabled; resolve it before bootstrapping."
    return 1
  }
  sudo sh -c 'set -C; : > "$1"' sh "$APP_BASE/maintenance" || return 1
  MAINTENANCE_CREATED=1
  sudo chmod 0644 "$APP_BASE/maintenance"
}

recover_legacy_installation() {
  if [ "$MAINTENANCE_CREATED" -eq 1 ]; then
    log "Bootstrap failed; restoring the untouched v2.1.1 topology under maintenance."
    stop_and_prove_service_inactive || return 1
    [ -d "$LEGACY_RELEASE" ] || return 1
    sudo ln -sfn "$LEGACY_RELEASE" "$CURRENT_LINK" || return 1
    if [ -n "$LEGACY_RESCUE" ] && sudo test -f "$LEGACY_RESCUE/kotoba.service"; then
      sudo install -m 0644 "$LEGACY_RESCUE/kotoba.service" /etc/systemd/system/kotoba.service || return 1
    fi
    sudo systemctl daemon-reload || return 1
    sudo systemctl start kotoba || return 1
    wait_for_legacy_health || return 1
  else
    wait_for_legacy_health || return 1
  fi
  restore_legacy_crontabs || return 1
  cleanup_failed_new_topology || return 1
  if [ -n "$FAILED_RELEASE" ] && [ -d "$FAILED_RELEASE" ]; then
    quarantine_release "$FAILED_RELEASE" || true
  fi
  if [ "$MAINTENANCE_CREATED" -eq 1 ]; then
    leave_maintenance || return 1
    MAINTENANCE_CREATED=0
  fi
  LEGACY_STOPPED=0
}

retire_legacy_release() {
  local rescue_release
  rescue_release="$RELEASES_DIR/.legacy-$(basename "$LEGACY_RELEASE")-$STAMP-$$"
  [ ! -e "$rescue_release" ] || return 1
  sudo mv -- "$LEGACY_RELEASE" "$rescue_release" || return 1
  LEGACY_RELEASE="$rescue_release"
  log "Retained the legacy code at $rescue_release; the full data rescue is $LEGACY_RESCUE."
}

bootstrap_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$rc" -ne 0 ] && [ "$BOOTSTRAP_COMPLETE" -ne 1 ]; then
    if [ "$CRONTABS_TOUCHED" -eq 1 ] ||
      [ "$MAINTENANCE_CREATED" -eq 1 ] ||
      [ "$NEW_DB_CREATED" -eq 1 ] ||
      [ "$NEW_ENV_CREATED" -eq 1 ] ||
      [ -n "$FAILED_RELEASE" ]; then
      if ! recover_legacy_installation; then
        log "EMERGENCY: legacy recovery failed; maintenance remains enabled. Rescue: ${LEGACY_RESCUE:-not-created}"
      fi
    fi
  fi
  [ -z "$USER_CRON_TMP" ] || rm -f -- "$USER_CRON_TMP" || true
  [ -z "$ROOT_CRON_TMP" ] || rm -f -- "$ROOT_CRON_TMP" || true
  exit "$rc"
}

main() {
  require_keep_versions
  require_unprivileged_operator
  require_supported_topology || die "Unsupported deployment topology."
  require_repo_url
  ensure_bun
  ensure_layout
  acquire_deploy_lock
  require_existing_nginx_site_compatible ||
    die "Merge the v2.1.2 maintenance/SSE/IP/rate-limit hooks into the live nginx site before bootstrapping."
  require_legacy_installation
  require_deploy_ref >/dev/null
  require_legacy_service_ready || die "The legacy service is not ready for a safe bootstrap."
  capture_and_disable_legacy_crontabs ||
    die "Could not suspend and verify the legacy backup schedule."

  enter_bootstrap_maintenance || die "Could not safely enable maintenance mode."
  stop_and_prove_service_inactive || die "Could not stop and prove the legacy service inactive."
  snapshot_legacy_installation || die "Could not create the immutable v2.1.1 rescue set."
  seed_new_topology || die "Could not seed the v2.1.2 data/config topology."

  ref=$(require_deploy_ref)
  log "Preparing the first v2.1.2 release from explicit ref: $ref"
  prepare_release "$ref" >/dev/null || die "Release preparation failed."
  release_dir="$PREPARED_RELEASE_DIR"
  FAILED_RELEASE="$release_dir"
  run_migrations "$release_dir" || die "Migration failed."
  activate_release "$release_dir" || die "Candidate readiness failed."
  retire_legacy_release || die "Candidate is healthy but the legacy rescue code could not be retired."
  install_bootstrap_backup_schedule || die "Could not install the v2.1.2 backup schedule."
  # Commit the successful state before the only fail-open transition. If the
  # shell is interrupted before leave_maintenance, traffic stays closed; after
  # it, EXIT must not roll a healthy candidate back to the legacy topology.
  FAILED_RELEASE=""
  LEGACY_STOPPED=0
  CRONTABS_TOUCHED=0
  BOOTSTRAP_COMPLETE=1
  leave_maintenance || die "Could not disable maintenance after candidate readiness."
  MAINTENANCE_CREATED=0
  log "Bootstrap completed at $ref. Rescue set: $LEGACY_RESCUE"
}

trap bootstrap_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
main "$@"
