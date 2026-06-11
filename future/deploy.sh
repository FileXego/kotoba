#!/usr/bin/env bash
set -euo pipefail

APP_BASE="${APP_BASE:-/opt/kotoba}"
RELEASES_DIR="$APP_BASE/releases"
CURRENT_LINK="$APP_BASE/current"
SHARED_DIR="${KOTOBA_SHARED_DIR:-$APP_BASE/shared}"
ENV_FILE="$SHARED_DIR/.env"
DB_PATH="$SHARED_DIR/sqlite.db"
UPLOAD_DIR="$SHARED_DIR/uploads"
KEEP_VERSIONS="${KEEP_VERSIONS:-3}"
REPO_URL="${KOTOBA_REPO_URL:-$(git config --get remote.origin.url 2>/dev/null || true)}"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { log "ERROR: $*"; exit 1; }

require_repo_url() {
  [ -n "$REPO_URL" ] || die "Set KOTOBA_REPO_URL to your repository URL before deploying."
}

latest_ref() {
  if [ -n "${KOTOBA_REF:-}" ]; then
    printf '%s\n' "$KOTOBA_REF"
    return
  fi

  local tag
  tag=$(git ls-remote --tags --refs "$REPO_URL" 'v*' 2>/dev/null | awk -F/ '{print $3}' | sort -V | tail -1)
  if [ -n "$tag" ]; then
    printf '%s\n' "$tag"
  else
    printf '%s\n' "main"
  fi
}

safe_ref_name() {
  printf '%s' "$1" | tr '/:' '--'
}

ensure_bun() {
  local bun_ver
  bun_ver=$(bun --version 2>/dev/null || echo "0")
  if [ "$(printf '%s\n' "1.1" "$bun_ver" | sort -V | head -1)" != "1.1" ]; then
    die "Bun >= 1.1 required. Current: $bun_ver"
  fi
  sudo ln -sf "$(command -v bun)" /usr/local/bin/bun
}

ensure_layout() {
  sudo mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$UPLOAD_DIR" "$SHARED_DIR/backups"
  if ! id kotoba >/dev/null 2>&1; then
    sudo useradd --system --home "$APP_BASE" --shell /usr/sbin/nologin kotoba
  fi
  sudo chown -R kotoba:kotoba "$APP_BASE"
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    [ -f .env.example ] || die ".env.example not found; run deploy.sh from a project checkout for init."
    sudo cp .env.example "$ENV_FILE"
    sudo chown kotoba:kotoba "$ENV_FILE"
    log "Created $ENV_FILE from .env.example. Edit it, then rerun deploy."
    exit 0
  fi

  sudo touch "$ENV_FILE"
  sudo grep -q '^DB_PATH=' "$ENV_FILE" || echo "DB_PATH=$DB_PATH" | sudo tee -a "$ENV_FILE" >/dev/null
  sudo grep -q '^UPLOAD_DIR=' "$ENV_FILE" || echo "UPLOAD_DIR=$UPLOAD_DIR" | sudo tee -a "$ENV_FILE" >/dev/null

  if sudo grep -Eq '^COOKIE_SECRET=(dev-secret|dev-secret-change-me)?$' "$ENV_FILE"; then
    die "Edit $ENV_FILE and set a real COOKIE_SECRET."
  fi
  if sudo grep -Eq '^TURNSTILE_SECRET=1x0000000000000000000000000000000AA$' "$ENV_FILE"; then
    die "Edit $ENV_FILE and set a real TURNSTILE_SECRET."
  fi
  if sudo grep -Eq '^SKIP_(CAPTCHA|RATE_LIMIT)=1$' "$ENV_FILE"; then
    die "SKIP_CAPTCHA/SKIP_RATE_LIMIT are not allowed in production."
  fi
}

prepare_release() {
  local ref="$1"
  local release_name="kotoba-$(safe_ref_name "$ref")-$(date +%Y%m%d%H%M%S)"
  local release_dir="$RELEASES_DIR/$release_name"

  git clone "$REPO_URL" "$release_dir"
  git -C "$release_dir" checkout "$ref"
  sudo ln -sfn "$ENV_FILE" "$release_dir/.env"
  sudo chown -R kotoba:kotoba "$release_dir"

  (
    cd "$release_dir"
    bun install --frozen-lockfile
    bun install --cwd client --frozen-lockfile
    bun run --cwd client build
    DB_PATH="$DB_PATH" bun run db:migrate
  )

  printf '%s\n' "$release_dir"
}

activate_release() {
  local release_dir="$1"
  sudo ln -sfn "$release_dir" "$CURRENT_LINK"
  sudo cp "$release_dir/future/kotoba.service" /etc/systemd/system/kotoba.service
  sudo systemctl daemon-reload
  sudo systemctl enable kotoba
  sudo systemctl restart kotoba
  sleep 3
  sudo systemctl is-active --quiet kotoba || {
    sudo journalctl -u kotoba --no-pager -n 40
    return 1
  }
}

cleanup_versions() {
  local count
  count=$(find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -name 'kotoba-*' | wc -l)
  while [ "$count" -gt "$KEEP_VERSIONS" ]; do
    local oldest
    oldest=$(find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -name 'kotoba-*' -printf '%T@ %p\n' | sort -n | head -1 | cut -d' ' -f2-)
    [ -n "$oldest" ] || break
    sudo rm -rf "$oldest"
    count=$((count - 1))
  done
}

install_nginx() {
  sudo cp "$CURRENT_LINK/future/nginx.conf" /etc/nginx/sites-available/kotoba
  sudo ln -sf /etc/nginx/sites-available/kotoba /etc/nginx/sites-enabled/kotoba
  sudo nginx -t
  sudo systemctl reload nginx
}

backup_now() {
  "$CURRENT_LINK/future/backup.sh"
}

case "${1:-update}" in
  init)
    require_repo_url
    ensure_bun
    ensure_layout
    ensure_env_file
    ref=$(latest_ref)
    log "Deploying initial release: $ref"
    release_dir=$(prepare_release "$ref")
    activate_release "$release_dir"
    install_nginx
    (crontab -l 2>/dev/null | grep -v 'future/backup.sh' || true; echo "0 3 * * * $CURRENT_LINK/future/backup.sh") | crontab -
    log "Deployed $ref. Edit /etc/nginx/sites-available/kotoba with your domain, then run certbot."
    ;;

  update)
    require_repo_url
    ensure_bun
    ensure_layout
    ensure_env_file
    [ -L "$CURRENT_LINK" ] || die "Not deployed yet. Run: future/deploy.sh init"
    previous=$(readlink -f "$CURRENT_LINK")
    ref=$(latest_ref)
    log "Deploying update: $ref"
    backup_now
    release_dir=$(prepare_release "$ref")
    if ! activate_release "$release_dir"; then
      log "New release failed; rolling back to $previous"
      sudo ln -sfn "$previous" "$CURRENT_LINK"
      sudo systemctl restart kotoba
      exit 1
    fi
    cleanup_versions
    log "Updated to $ref"
    ;;

  rollback)
    [ -L "$CURRENT_LINK" ] || die "Not deployed"
    current=$(readlink -f "$CURRENT_LINK")
    previous=$(find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -name 'kotoba-*' -printf '%T@ %p\n' | sort -nr | awk '{print $2}' | grep -v "^$current$" | head -1)
    [ -n "$previous" ] || die "No previous release found"
    backup_now
    sudo ln -sfn "$previous" "$CURRENT_LINK"
    sudo systemctl restart kotoba
    log "Rolled back to $(basename "$previous")"
    ;;

  list)
    find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -name 'kotoba-*' -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | sort -r || true
    ;;

  *)
    echo "Usage: $0 {init|update|rollback|list}"
    echo "Environment: KOTOBA_REPO_URL, KOTOBA_REF, APP_BASE, KOTOBA_SHARED_DIR, KEEP_VERSIONS"
    exit 1
    ;;
esac
