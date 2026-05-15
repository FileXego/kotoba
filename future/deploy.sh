#!/bin/bash
set -e

APP_BASE="/opt"
APP_SYMLINK="$APP_BASE/kotoba"
KEEP_VERSIONS=3

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# get latest git tag
latest_tag() {
  git tag --sort=-v:refname | grep -E '^v[0-9]' | head -1
}

# rollback to previous version
rollback() {
  log "❌ Rolling back..."
  local prev
  prev=$(ls -dt "$APP_BASE"/kotoba-v* 2>/dev/null | sed -n '2p')
  if [ -n "$prev" ]; then
    ln -sfn "$prev" "$APP_SYMLINK"
    sudo systemctl restart kotoba
    log "✅ Rolled back to $prev"
  else
    log "⚠️ No previous version to roll back to"
  fi
  exit 1
}

# cleanup old versions
cleanup_versions() {
  local count
  count=$(ls -dt "$APP_BASE"/kotoba-v* 2>/dev/null | wc -l)
  while [ "$count" -gt "$KEEP_VERSIONS" ]; do
    local oldest
    oldest=$(ls -dt "$APP_BASE"/kotoba-v* | tail -1)
    log "🗑 Removing $oldest"
    rm -rf "$oldest"
    count=$((count - 1))
  done
}

case "${1:-update}" in
  init)
    log "=== Kotoba first-time deployment ==="

    TAG=$(cd /opt/kotoba 2>/dev/null && latest_tag || echo "v1.0.0")
    APP_DIR="$APP_BASE/kotoba-$TAG"

    if [ -d "$APP_DIR" ]; then
      log "⚠️ $APP_DIR already exists"
      exit 1
    fi

    git clone https://github.com/FileXego/kotoba.git "$APP_DIR"
    cd "$APP_DIR"
    git checkout "$TAG" 2>/dev/null || true

    [ ! -f .env ] && cp .env.example .env
    if ! grep -q "COOKIE_SECRET=dev-secret" .env; then
      log "⚠️  Edit $APP_DIR/.env with your real COOKIE_SECRET"
      log "   Then re-run: $0 init"
      exit 0
    fi

    bun install
    cd client && bun install && bun run build && cd ..
    bun run db:migrate

    # integrity check
    SHA=$(git rev-parse HEAD)
    log "✅ SHA256: $SHA"

    # symlink
    ln -sfn "$APP_DIR" "$APP_SYMLINK"

    # systemd
    sudo cp "$APP_DIR/future/kotoba.service" /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable kotoba
    sudo systemctl start kotoba

    # check startup
    sleep 3
    if ! sudo systemctl is-active --quiet kotoba; then
      log "❌ Service failed to start!"
      sudo journalctl -u kotoba --no-pager -n 20
      rm -f "$APP_SYMLINK"
      exit 1
    fi

    # nginx
    sudo cp "$APP_DIR/future/nginx.conf" /etc/nginx/sites-available/kotoba
    sudo sed -i "s/YOUR_DOMAIN/$(hostname)/g" /etc/nginx/sites-available/kotoba
    sudo ln -sf /etc/nginx/sites-available/kotoba /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx

    # backup
    (crontab -l 2>/dev/null; echo "0 3 * * * $APP_DIR/future/backup.sh") | crontab -

    log "=== ✅ Deployed $TAG ==="
    log "   Domain: sudo nano /etc/nginx/sites-available/kotoba"
    log "   HTTPS:  sudo certbot --nginx"
    ;;

  update)
    cd "$APP_SYMLINK" 2>/dev/null || { log "❌ Not deployed yet. Run: $0 init"; exit 1; }

    git fetch --tags
    TAG=$(git -C "$APP_SYMLINK" fetch --tags 2>/dev/null; git -C "$APP_SYMLINK" tag --sort=-v:refname | grep '^v' | head -1)
    CURRENT=$(readlink -f "$APP_SYMLINK" | xargs basename)

    if [ "$CURRENT" = "kotoba-$TAG" ]; then
      log "Already at $TAG"
      exit 0
    fi

    log "=== Deploying $TAG (current: $CURRENT) ==="

    NEW_DIR="$APP_BASE/kotoba-$TAG"
    if [ -d "$NEW_DIR" ]; then
      log "⚠️ $NEW_DIR exists — checking integrity"
      cd "$NEW_DIR"
      git fetch origin tag "$TAG"
      git checkout "$TAG"
    else
      git clone https://github.com/FileXego/kotoba.git "$NEW_DIR"
      cd "$NEW_DIR"
      git checkout "$TAG"
    fi

    # copy .env from current
    cp "$APP_SYMLINK/.env" "$NEW_DIR/.env" 2>/dev/null || cp .env.example .env
    # copy uploads
    cp -r "$APP_SYMLINK/uploads" "$NEW_DIR/uploads" 2>/dev/null || true

    # build
    bun install
    cd client && bun install && bun run build && cd ..
    bun run db:migrate

    # integrity
    EXPECTED=$(git rev-parse HEAD)
    ACTUAL=$(git -C "$NEW_DIR" rev-parse HEAD)
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      log "❌ Integrity check failed! Expected $EXPECTED, got $ACTUAL"
      exit 1
    fi
    log "✅ Integrity: $EXPECTED"

    # swap symlink
    ln -sfn "$NEW_DIR" "$APP_SYMLINK"

    # restart
    sudo systemctl restart kotoba
    sleep 3
    if ! sudo systemctl is-active --quiet kotoba; then
      log "❌ New version failed to start!"
      sudo journalctl -u kotoba --no-pager -n 20
      log "Rolling back to $CURRENT..."
      ln -sfn "$APP_BASE/$CURRENT" "$APP_SYMLINK"
      sudo systemctl restart kotoba
      log "✅ Rollback complete"
      exit 1
    fi

    cleanup_versions
    log "=== ✅ Updated to $TAG ==="
    ;;

  rollback)
    cd "$APP_SYMLINK" 2>/dev/null || { log "❌ Not deployed"; exit 1; }
    CURRENT=$(readlink -f "$APP_SYMLINK" | xargs basename)
    PREV=$(ls -dt "$APP_BASE"/kotoba-v* 2>/dev/null | sed -n '2p')
    if [ -z "$PREV" ]; then
      log "❌ No previous version"
      exit 1
    fi
    log "Rolling back from $CURRENT to $(basename "$PREV")"
    ln -sfn "$PREV" "$APP_SYMLINK"
    sudo systemctl restart kotoba
    log "✅ Done"
    ;;

  list)
    ls -lt "$APP_BASE"/kotoba-v* 2>/dev/null | awk '{print $NF}' || echo "No versions"
    ;;

  *)
    echo "Usage: $0 {init|update|rollback|list}"
    ;;
esac
