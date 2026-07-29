#!/usr/bin/env bash
set -euo pipefail

APP_BASE="${APP_BASE:-/opt/kotoba}"
RELEASES_DIR="$APP_BASE/releases"
CURRENT_LINK="$APP_BASE/current"
CONFIG_DIR="$APP_BASE/config"
SHARED_DIR="$APP_BASE/shared"
DATA_DIR="$SHARED_DIR/data"
ENV_FILE="$CONFIG_DIR/kotoba.env"
DB_PATH="$DATA_DIR/sqlite.db"
UPLOAD_DIR="$SHARED_DIR/uploads"
BACKUP_DIR="$APP_BASE/backups"
KEEP_VERSIONS="${KEEP_VERSIONS:-3}"
REPO_URL="${KOTOBA_REPO_URL:-$(git config --get remote.origin.url 2>/dev/null || true)}"
BUN_VERSION="1.3.11"
BUN_BIN="/usr/local/bin/bun"
BUILD_USER="kotoba-build"
HEALTH_URL="${KOTOBA_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
ROOT_URL="${KOTOBA_ROOT_URL:-http://127.0.0.1:3000/}"
PREPARED_RELEASE_DIR=""
DEPLOY_LOCK_FILE="$APP_BASE/deploy.lock"
NGINX_SITE_FILE="/etc/nginx/sites-available/kotoba"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

require_keep_versions() {
  [[ "$KEEP_VERSIONS" =~ ^[1-9][0-9]*$ ]] ||
    die "KEEP_VERSIONS must be a positive integer."
}

require_repo_url() {
  [ -n "$REPO_URL" ] || die "Set KOTOBA_REPO_URL to the repository URL before deploying."
}

require_supported_topology() {
  local variable
  for variable in KOTOBA_CONFIG_DIR KOTOBA_SHARED_DIR KOTOBA_ENV_FILE KOTOBA_BACKUP_DIR; do
    if [ -n "${!variable:-}" ]; then
      log "$variable is no longer supported. Set APP_BASE only so systemd, nginx, backups, and migrations share one topology."
      return 1
    fi
  done
  if ! [[ "$APP_BASE" =~ ^/(opt|srv)/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ ]]; then
    log "APP_BASE must be a canonical path below /opt or /srv using only letters, digits, dot, underscore, dash, and slash."
    return 1
  fi
  case "$APP_BASE/" in
    *"/./"*|*"/../"*)
      log "APP_BASE must not contain dot path segments."
      return 1
      ;;
  esac
  [ "$APP_BASE" != "/opt" ] && [ "$APP_BASE" != "/srv" ] || {
    log "APP_BASE must be a dedicated child directory, not /opt or /srv itself."
    return 1
  }
}

require_deploy_ref() {
  local ref="${KOTOBA_REF:-}"
  [ -n "$ref" ] || die "Set KOTOBA_REF to an explicitly reviewed immutable tag or commit SHA."
  case "$ref" in
    *$'\n'*|*$'\r'*) die "KOTOBA_REF contains an invalid newline." ;;
  esac
  if ! [[ "$ref" =~ ^[0-9a-fA-F]{40}$ || "$ref" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([._-][A-Za-z0-9._-]+)?$ ]]; then
    die "KOTOBA_REF must be a full 40-character commit SHA or a version tag such as v2.1.2."
  fi
  printf '%s\n' "$ref"
}

safe_ref_name() {
  local safe
  safe=$(printf '%s' "$1" | tr '/:' '--' | tr -cd 'A-Za-z0-9._-')
  [ -n "$safe" ] || safe="release"
  printf '%.80s' "$safe"
}

ensure_bun() {
  local bun_path bun_ver
  bun_ver=$(bun --version 2>/dev/null || printf 'missing')
  [ "$bun_ver" = "$BUN_VERSION" ] || die "Bun $BUN_VERSION is required. Current: $bun_ver"
  bun_path=$(command -v bun) || die "Bun $BUN_VERSION is required but was not found on PATH."
  if [ "$bun_path" != "/usr/local/bin/bun" ]; then
    sudo install -m 0755 "$bun_path" /usr/local/bin/bun
  fi
}

require_unprivileged_operator() {
  [ "$EUID" -ne 0 ] ||
    die "Run deploy.sh as a dedicated non-root deployment account with sudo access; do not run repository build scripts as root."
}

validate_build_user() {
  local entry uid home shell primary_gid named_group_gid all_gids
  entry=$(getent passwd "$BUILD_USER") || return 1
  IFS=: read -r _ _ uid _ _ home shell <<< "$entry"
  [[ "$uid" =~ ^[0-9]+$ ]] && [ "$uid" -lt 1000 ] || return 1
  [ "$home" = "/nonexistent" ] || return 1
  [ "$shell" = "/usr/sbin/nologin" ] || return 1

  primary_gid=$(id -g "$BUILD_USER") || return 1
  named_group_gid=$(getent group "$BUILD_USER" | cut -d: -f3) || return 1
  [ -n "$named_group_gid" ] && [ "$primary_gid" = "$named_group_gid" ] || return 1
  all_gids=$(id -G "$BUILD_USER") || return 1
  [ "$all_gids" = "$primary_gid" ]
}

ensure_layout() {
  local builder_created=0
  if ! id kotoba >/dev/null 2>&1; then
    sudo useradd --system --home "$APP_BASE" --shell /usr/sbin/nologin kotoba
  fi
  if ! id "$BUILD_USER" >/dev/null 2>&1; then
    sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin "$BUILD_USER"
    builder_created=1
  fi
  if [ "$builder_created" -eq 1 ]; then
    if ! getent group "$BUILD_USER" >/dev/null; then
      sudo groupadd --system "$BUILD_USER"
    fi
    sudo usermod --gid "$BUILD_USER" "$BUILD_USER"
  fi
  validate_build_user ||
    die "$BUILD_USER must be a dedicated non-login system account with its own group."

  sudo install -d -o root -g root -m 0755 "$APP_BASE" "$RELEASES_DIR" "$SHARED_DIR"
  sudo install -d -o root -g kotoba -m 0750 "$CONFIG_DIR"
  sudo install -d -o kotoba -g kotoba -m 0700 "$DATA_DIR" "$UPLOAD_DIR"
  sudo install -d -o root -g root -m 0700 "$BACKUP_DIR"
}

acquire_deploy_lock() {
  sudo touch "$DEPLOY_LOCK_FILE" || return 1
  sudo chown "$(id -u):$(id -g)" "$DEPLOY_LOCK_FILE" || return 1
  exec 9>"$DEPLOY_LOCK_FILE"
  flock -n 9 || die "Another Kotoba deployment or rollback is already running."
}

stop_build_user_processes() {
  local attempt status pkill_bin pgrep_bin
  pkill_bin=$(command -v pkill) || {
    log "pkill is required to contain builder lifecycle processes."
    return 1
  }
  pgrep_bin=$(command -v pgrep) || {
    log "pgrep is required to verify builder lifecycle process cleanup."
    return 1
  }

  sudo "$pkill_bin" -TERM -u "$BUILD_USER" >/dev/null 2>&1 || {
    status=$?
    [ "$status" -eq 1 ] || return 1
  }
  for attempt in 1 2 3; do
    if sudo "$pgrep_bin" -u "$BUILD_USER" >/dev/null 2>&1; then
      sleep 1
      continue
    else
      status=$?
      [ "$status" -eq 1 ] && return 0
      return 1
    fi
  done

  sudo "$pkill_bin" -KILL -u "$BUILD_USER" >/dev/null 2>&1 || {
    status=$?
    [ "$status" -eq 1 ] || return 1
  }
  for attempt in 1 2 3; do
    if sudo "$pgrep_bin" -u "$BUILD_USER" >/dev/null 2>&1; then
      sleep 1
      continue
    else
      status=$?
      [ "$status" -eq 1 ] && return 0
      return 1
    fi
  done
  log "Residual $BUILD_USER processes survived TERM and KILL."
  return 1
}

upsert_env() {
  local key="$1"
  local value="$2"
  local escaped="${value//\\/\\\\}"
  escaped="${escaped//&/\\&}"
  escaped="${escaped//|/\\|}"

  if sudo grep -q "^${key}=" "$ENV_FILE"; then
    sudo sed -i "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" | sudo tee -a "$ENV_FILE" >/dev/null
  fi
}

env_value() {
  local key="$1"
  sudo awk -F= -v key="$key" '$1 == key { value=substr($0, index($0, "=") + 1) } END { print value }' "$ENV_FILE"
}

validate_env_syntax() {
  local snapshot="${1:-}" line key value syntax_error=""
  local owns_snapshot=0
  local line_number=0
  declare -A seen_keys=()

  if [ -z "$snapshot" ]; then
    snapshot=$(mktemp) || return 1
    owns_snapshot=1
    if ! sudo cat "$ENV_FILE" > "$snapshot"; then
      rm -f "$snapshot"
      return 1
    fi
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line_number=$((line_number + 1))
    line="${line%$'\r'}"
    [ -z "$line" ] && continue
    case "$line" in
      \#*) continue ;;
      [[:space:]]*|*[[:space:]])
        syntax_error="line $line_number has leading or trailing whitespace"
        break
        ;;
    esac
    if ! [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      syntax_error="line $line_number is not a plain KEY=value assignment"
      break
    fi

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case "$value" in
      [[:space:]]*|*[[:space:]])
        syntax_error="line $line_number has leading or trailing value whitespace"
        break
        ;;
      *\"*|*\'*|*\\*)
        syntax_error="line $line_number uses quoting or escaping that would be interpreted by systemd"
        break
        ;;
    esac
    if [ -n "${seen_keys[$key]+present}" ]; then
      syntax_error="line $line_number duplicates $key"
      break
    fi
    seen_keys["$key"]=1

    case "$key" in
      COOKIE_SECRET|TURNSTILE_SECRET|VITE_TURNSTILE_SITEKEY|VITE_MOBILE_ROUTES_ENABLED|\
      UPLOAD_MAX_BYTES|DB_PATH|UPLOAD_DIR|NODE_ENV|HOST|PORT)
        ;;
      *)
        syntax_error="line $line_number sets unsupported environment key $key"
        break
        ;;
    esac
  done < "$snapshot"
  if [ "$owns_snapshot" -eq 1 ]; then
    rm -f "$snapshot"
  fi

  if [ -n "$syntax_error" ]; then
    log "Invalid $ENV_FILE: $syntax_error."
    return 1
  fi
}

validate_env_file() {
  local cookie_secret turnstile_secret site_key mobile_routes upload_max
  local configured_db configured_upload node_env host port snapshot line key value
  cookie_secret=""
  turnstile_secret=""
  site_key=""
  mobile_routes=""
  node_env=""
  host=""
  port=""
  configured_db=""
  configured_upload=""
  upload_max=""

  snapshot=$(mktemp) || die "Could not create a temporary environment validation file."
  if ! sudo cat "$ENV_FILE" > "$snapshot"; then
    rm -f "$snapshot"
    die "Could not read $ENV_FILE."
  fi
  if ! validate_env_syntax "$snapshot"; then
    rm -f "$snapshot"
    die "$ENV_FILE is not a safe systemd EnvironmentFile."
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$key" in
      COOKIE_SECRET) cookie_secret="$value" ;;
      TURNSTILE_SECRET) turnstile_secret="$value" ;;
      VITE_TURNSTILE_SITEKEY) site_key="$value" ;;
      VITE_MOBILE_ROUTES_ENABLED) mobile_routes="$value" ;;
      NODE_ENV) node_env="$value" ;;
      HOST) host="$value" ;;
      PORT) port="$value" ;;
      DB_PATH) configured_db="$value" ;;
      UPLOAD_DIR) configured_upload="$value" ;;
      UPLOAD_MAX_BYTES) upload_max="$value" ;;
    esac
  done < "$snapshot"
  rm -f "$snapshot"

  [ "$node_env" = "production" ] || die "NODE_ENV must be exactly production."
  [ "$host" = "127.0.0.1" ] || die "HOST must be exactly 127.0.0.1."
  [ "$port" = "3000" ] || die "PORT must be exactly 3000."
  [ "$configured_db" = "$DB_PATH" ] || die "DB_PATH must be exactly $DB_PATH."
  [ "$configured_upload" = "$UPLOAD_DIR" ] || die "UPLOAD_DIR must be exactly $UPLOAD_DIR."
  [ "${#cookie_secret}" -ge 32 ] || die "COOKIE_SECRET must contain at least 32 characters."
  case "$cookie_secret" in
    dev-secret|dev-secret-change-me) die "COOKIE_SECRET still uses a development value." ;;
  esac
  [ -n "$turnstile_secret" ] || die "TURNSTILE_SECRET is required."
  [ "$turnstile_secret" != "1x0000000000000000000000000000000AA" ] ||
    die "TURNSTILE_SECRET must not use Cloudflare's test key."
  [ -n "$site_key" ] || die "VITE_TURNSTILE_SITEKEY is required."
  [ "$site_key" != "1x00000000000000000000AA" ] ||
    die "VITE_TURNSTILE_SITEKEY must not use Cloudflare's test key."
  case "$mobile_routes" in
    true|false) ;;
    *) die "VITE_MOBILE_ROUTES_ENABLED must be exactly true or false." ;;
  esac
  [[ "$upload_max" =~ ^[1-9][0-9]*$ ]] || die "UPLOAD_MAX_BYTES must be a positive integer."
  [ "${#upload_max}" -le 18 ] || die "UPLOAD_MAX_BYTES is too large."
  [ "$upload_max" -ge 10485760 ] || die "UPLOAD_MAX_BYTES must be at least 10 MiB."

}

ensure_env_file() {
  local created=0
  if [ ! -f "$ENV_FILE" ]; then
    [ -f .env.example ] || die ".env.example not found; run deploy.sh from a project checkout for initialization."
    sudo cp .env.example "$ENV_FILE"
    created=1
  fi

  validate_env_syntax || die "$ENV_FILE is not a safe systemd EnvironmentFile."
  upsert_env DB_PATH "$DB_PATH"
  upsert_env UPLOAD_DIR "$UPLOAD_DIR"
  upsert_env NODE_ENV "production"
  upsert_env HOST "127.0.0.1"
  upsert_env PORT "3000"
  sudo chmod 0640 "$ENV_FILE"
  if id kotoba >/dev/null 2>&1; then
    sudo chown root:kotoba "$ENV_FILE"
  fi

  if [ "$created" -eq 1 ]; then
    log "Created $ENV_FILE. Replace the development secrets, then rerun this command."
    return 2
  fi
  validate_env_file
}

remove_incomplete_release() {
  local release_dir="$1"
  case "$release_dir" in
    "$RELEASES_DIR"/kotoba-*) sudo rm -rf -- "$release_dir" ;;
    *) log "Refusing to remove unexpected release path: $release_dir"; return 1 ;;
  esac
}

prepare_release() {
  local ref="$1"
  local release_name release_dir commit deploy_user deploy_group site_key mobile_routes build_home build_status
  local build_dir canonical_build_dir source_status unsafe_static_output
  release_name="kotoba-$(safe_ref_name "$ref")-$(date +%Y%m%d%H%M%S)-$$"
  release_dir="$RELEASES_DIR/$release_name"
  PREPARED_RELEASE_DIR=""

  deploy_user=$(id -un)
  deploy_group=$(id -gn 2>/dev/null || true)
  [ -n "$deploy_group" ] || deploy_group=$(id -g)
  sudo install -d -m 0755 "$release_dir" || return 1
  sudo chown "$deploy_user:$deploy_group" "$release_dir" || {
    remove_incomplete_release "$release_dir"
    return 1
  }

  git clone "$REPO_URL" "$release_dir" >&2 || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  commit=$(git -C "$release_dir" rev-parse --verify "${ref}^{commit}" 2>/dev/null) || {
    log "The requested KOTOBA_REF does not resolve to a commit: $ref"
    remove_incomplete_release "$release_dir"
    return 1
  }
  git -C "$release_dir" checkout --detach "$commit" >&2 || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  # Do not leave an authenticated clone URL where dependency lifecycle scripts can read it.
  git -C "$release_dir" remote remove origin >/dev/null 2>&1 || true
  # Lifecycle scripts may write only dependency/build output directories. Source,
  # .git, and the root-installed systemd/nginx/backup templates remain root-owned.
  sudo chown -R root:root "$release_dir" || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  sudo chmod -R go-w "$release_dir" || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  for build_dir in \
    "$release_dir/node_modules" \
    "$release_dir/client/node_modules" \
    "$release_dir/client/dist"; do
    if sudo test -L "$build_dir" || { sudo test -e "$build_dir" && ! sudo test -d "$build_dir"; }; then
      log "Refusing unsafe builder output path: $build_dir"
      remove_incomplete_release "$release_dir"
      return 1
    fi
    sudo install -d -o "$BUILD_USER" -g "$BUILD_USER" -m 0755 "$build_dir" || {
      remove_incomplete_release "$release_dir"
      return 1
    }
    canonical_build_dir=$(sudo realpath -e -- "$build_dir") || {
      remove_incomplete_release "$release_dir"
      return 1
    }
    [ "$canonical_build_dir" = "$build_dir" ] || {
      log "Builder output escaped its release path: $build_dir"
      remove_incomplete_release "$release_dir"
      return 1
    }
  done

  site_key=$(env_value VITE_TURNSTILE_SITEKEY)
  mobile_routes=$(env_value VITE_MOBILE_ROUTES_ENABLED)
  build_home=$(mktemp -d "${TMPDIR:-/tmp}/kotoba-build.XXXXXX") || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  sudo chown -R "$BUILD_USER:$BUILD_USER" "$build_home" || {
    sudo rm -rf -- "$build_home"
    remove_incomplete_release "$release_dir"
    return 1
  }
  build_status=0
  sudo -u "$BUILD_USER" env -i \
    PATH=/usr/local/bin:/usr/bin:/bin \
    HOME="$build_home" \
    XDG_CACHE_HOME="$build_home/cache" \
    TMPDIR="$build_home/tmp" \
    CI=1 \
    NODE_ENV=production \
    VITE_TURNSTILE_SITEKEY="$site_key" \
    VITE_MOBILE_ROUTES_ENABLED="$mobile_routes" \
    /bin/bash -c '
      set -euo pipefail
      mkdir -p "$XDG_CACHE_HOME" "$TMPDIR"
      cd "$1"
      /usr/local/bin/bun install --frozen-lockfile >&2
      /usr/local/bin/bun install --cwd client --frozen-lockfile >&2
      /usr/local/bin/bun run --cwd client build >&2
    ' kotoba-build "$release_dir" || build_status=$?
  if ! stop_build_user_processes; then
    sudo rm -rf -- "$build_home"
    remove_incomplete_release "$release_dir"
    return 1
  fi
  if [ "$build_status" -ne 0 ]; then
    sudo rm -rf -- "$build_home"
    remove_incomplete_release "$release_dir"
    return "$build_status"
  fi
  sudo rm -rf -- "$build_home" || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  if ! sudo git -C "$release_dir" diff --exit-code -- . >&2; then
    log "Builder modified reviewed source files."
    remove_incomplete_release "$release_dir"
    return 1
  fi
  source_status=$(sudo git -C "$release_dir" status --porcelain --untracked-files=normal) || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  if [ -n "$source_status" ]; then
    log "Builder created or modified a non-output source path."
    printf '%s\n' "$source_status" >&2
    remove_incomplete_release "$release_dir"
    return 1
  fi
  unsafe_static_output=$(
    sudo find "$release_dir/client/dist" -mindepth 1 \
      ! -type f ! -type d -print -quit
  ) || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  if [ -n "$unsafe_static_output" ]; then
    log "Builder produced a non-regular or symbolic static build output: $unsafe_static_output"
    remove_incomplete_release "$release_dir"
    return 1
  fi

  printf '%s\n' "$commit" | sudo tee "$release_dir/.release-revision" >/dev/null || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  sudo chown -R root:root "$release_dir" || {
    remove_incomplete_release "$release_dir"
    return 1
  }
  sudo chmod -R go-w "$release_dir" || {
    remove_incomplete_release "$release_dir"
    return 1
  }

  PREPARED_RELEASE_DIR="$release_dir"
  printf '%s\n' "$release_dir"
}

release_revision() {
  local release_dir="$1"
  [ -f "$release_dir/.release-revision" ] || return 1
  tr -d '\r\n' < "$release_dir/.release-revision"
}

mark_release_healthy() {
  local release_dir="$1"
  sudo touch "$release_dir/.release-healthy" || return 1
  sudo chmod 0444 "$release_dir/.release-healthy" || return 1
}

find_previous_healthy_release() {
  local current="$1"
  find "$RELEASES_DIR" -mindepth 2 -maxdepth 2 -type f -name '.release-healthy' -printf '%T@ %h\n' 2>/dev/null |
    sort -nr |
    cut -d' ' -f2- |
    grep -Fvx "$current" |
    head -1 || true
}

run_migrations() {
  local release_dir="$1"
  (
    cd "$release_dir" || exit 1
    sudo -u kotoba env \
      DB_PATH="$DB_PATH" \
      NODE_ENV=production \
      /usr/local/bin/bun run db:migrate
  )
}

render_service_file() {
  local release_dir="$1"
  local output="$2"
  sed "s|/opt/kotoba|$APP_BASE|g" "$release_dir/future/kotoba.service" > "$output"
}

install_runtime_config() {
  local release_dir="$1"
  local rendered_service rendered_nginx
  require_existing_nginx_site_compatible || return 1
  rendered_service=$(mktemp)
  rendered_nginx=$(mktemp)
  render_service_file "$release_dir" "$rendered_service" || {
    rm -f "$rendered_service" "$rendered_nginx"
    return 1
  }
  sed "s|/opt/kotoba|$APP_BASE|g" "$release_dir/future/nginx.conf" > "$rendered_nginx" || {
    rm -f "$rendered_service" "$rendered_nginx"
    return 1
  }

  sudo install -m 0644 "$rendered_service" /etc/systemd/system/kotoba.service || {
    rm -f "$rendered_service" "$rendered_nginx"
    return 1
  }
  rm -f "$rendered_service"
  sudo install -m 0644 "$release_dir/future/nginx-limits.conf" /etc/nginx/conf.d/kotoba-limits.conf || return 1
  if ! sudo test -f "$NGINX_SITE_FILE"; then
    sudo install -m 0644 "$rendered_nginx" "$NGINX_SITE_FILE" || {
      rm -f "$rendered_nginx"
      return 1
    }
  fi
  rm -f "$rendered_nginx"
  sudo ln -sfn "$NGINX_SITE_FILE" /etc/nginx/sites-enabled/kotoba || return 1
  sudo systemctl daemon-reload || return 1
  sudo nginx -t || return 1
  sudo systemctl reload nginx || return 1
}

extract_nginx_location_block() {
  local wanted="$1"
  awk -v wanted="$wanted" '
    {
      line = $0
      pattern = "^[[:space:]]*location[[:space:]]+" wanted "[[:space:]]*\\{"
      if (!capture && line ~ pattern) capture = 1
      if (capture) {
        print line
        opens = gsub(/\{/, "{", line)
        closes = gsub(/\}/, "}", line)
        depth += opens - closes
        if (opens > 0) opened = 1
        if (opened && depth <= 0) exit
      }
    }
  '
}

has_nginx_server_maintenance_guard() {
  awk -v expected="-f$APP_BASE/maintenance" '
    BEGIN {
      depth = 0
      server_parent = -1
      guard_parent = -1
      found = 0
    }
    {
      line = $0
      before = depth

      if (server_parent < 0 && line ~ /^[[:space:]]*server[[:space:]]*\{/) {
        server_parent = before
      }

      if (server_parent >= 0 && before == server_parent + 1 && line ~ /^[[:space:]]*if[[:space:]]*\(/) {
        condition = line
        sub(/^[^(]*\(/, "", condition)
        sub(/\).*/, "", condition)
        gsub(/[[:space:]]/, "", condition)
        if (condition == expected && line ~ /\{/) {
          guard_parent = before
          if (line ~ /return[[:space:]]+503[[:space:]]*;/) {
            found = 1
          }
        }
      } else if (guard_parent >= 0 && before > guard_parent && line ~ /return[[:space:]]+503[[:space:]]*;/) {
        found = 1
      }

      opens = gsub(/\{/, "{", line)
      closes = gsub(/\}/, "}", line)
      depth += opens - closes

      if (guard_parent >= 0 && depth <= guard_parent) {
        guard_parent = -1
      }
      if (server_parent >= 0 && depth <= server_parent) {
        server_parent = -1
        guard_parent = -1
      }
    }
    END {
      exit(found ? 0 : 1)
    }
  '
}

validate_nginx_site_file() {
  local site_file="$1"
  local effective event_block api_block
  effective=$(sed 's/[[:space:]]*#.*$//' "$site_file") || return 1
  event_block=$(extract_nginx_location_block "/api/events" <<< "$effective") || return 1
  api_block=$(extract_nginx_location_block "/api/" <<< "$effective") || return 1

  has_nginx_server_maintenance_guard <<< "$effective" &&
    [ -n "$event_block" ] &&
    [ -n "$api_block" ] &&
    grep -Eq 'proxy_buffering[[:space:]]+off' <<< "$event_block" &&
    grep -Eq 'proxy_cache[[:space:]]+off' <<< "$event_block" &&
    grep -Eq 'proxy_read_timeout[[:space:]]+1h' <<< "$event_block" &&
    grep -Eq 'proxy_set_header[[:space:]]+X-Real-IP[[:space:]]+\$remote_addr' <<< "$event_block" &&
    grep -Eq 'limit_req[[:space:]]+zone=api_perip' <<< "$event_block" &&
    grep -Eq 'proxy_set_header[[:space:]]+X-Real-IP[[:space:]]+\$remote_addr' <<< "$api_block" &&
    grep -Eq 'limit_req[[:space:]]+zone=api_perip' <<< "$api_block"
}

require_existing_nginx_site_compatible() {
  local snapshot
  if ! sudo test -f "$NGINX_SITE_FILE"; then
    return 0
  fi
  snapshot=$(mktemp)
  if ! sudo cat "$NGINX_SITE_FILE" > "$snapshot"; then
    rm -f "$snapshot"
    return 1
  fi
  if ! validate_nginx_site_file "$snapshot"; then
    rm -f "$snapshot"
    log "Existing $NGINX_SITE_FILE lacks Kotoba maintenance/SSE/IP/rate-limit hooks. Merge future/nginx.conf manually and rerun."
    return 1
  fi
  rm -f "$snapshot"
}

health_response_matches() {
  local response="$1"
  local expected_version="$2"
  local expected_revision="$3"
  printf '%s' "$response" |
    env EXPECTED_VERSION="$expected_version" EXPECTED_REVISION="$expected_revision" \
      "$BUN_BIN" -e '
        try {
          const body = JSON.parse(await Bun.stdin.text());
          const matches = body !== null
            && typeof body === "object"
            && !Array.isArray(body)
            && body.success === true
            && body.status === "ready"
            && body.version === process.env.EXPECTED_VERSION
            && body.revision === process.env.EXPECTED_REVISION;
          process.exit(matches ? 0 : 1);
        } catch {
          process.exit(1);
        }
      ' 2>/dev/null
}

wait_for_health() {
  local expected_revision="$1"
  local expected_version="$2"
  local response
  local attempt
  for attempt in $(seq 1 20); do
    if response=$(curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" 2>/dev/null); then
      if health_response_matches "$response" "$expected_version" "$expected_revision" &&
        curl --fail --silent --show-error --max-time 5 --output /dev/null "$ROOT_URL"; then
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

release_version() {
  local release_dir="$1"
  local version
  version=$(
    "$BUN_BIN" -e '
      try {
        const body = await Bun.file(Bun.argv[1]).json();
        if (typeof body.version !== "string") process.exit(1);
        process.stdout.write(body.version);
      } catch {
        process.exit(1);
      }
    ' "$release_dir/package.json" 2>/dev/null
  ) || return 1
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([._-][A-Za-z0-9._-]+)?$ ]] || return 1
  printf '%s\n' "$version"
}

activate_release() {
  local release_dir="$1"
  local expected_revision expected_version
  expected_revision=$(release_revision "$release_dir") || return 1
  expected_version=$(release_version "$release_dir") || return 1
  install_runtime_config "$release_dir" || return 1
  sudo ln -sfn "$release_dir" "$CURRENT_LINK" || return 1
  sudo systemctl enable kotoba || return 1
  sudo systemctl restart kotoba || return 1
  if ! wait_for_health "$expected_revision" "$expected_version"; then
    sudo journalctl -u kotoba --no-pager -n 60 || true
    return 1
  fi
  mark_release_healthy "$release_dir" || return 1
}

backup_now() {
  local release_dir="$1"
  sudo env APP_BASE="$APP_BASE" KOTOBA_DEPLOY_LOCK_HELD=1 bash "$release_dir/future/backup.sh"
}

stop_and_confirm_service_inactive() {
  local stop_rc=0
  local state_rc=0
  sudo systemctl stop kotoba || stop_rc=$?
  sudo systemctl is-active --quiet kotoba || state_rc=$?
  case "$state_rc" in
    3)
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

restore_database() {
  local backup_path="$1"
  local backup_name canonical_backup canonical_backup_dir
  sudo test -f "$backup_path" || return 1
  canonical_backup_dir=$(sudo realpath -e -- "$BACKUP_DIR") || return 1
  canonical_backup=$(sudo realpath -e -- "$backup_path") || return 1
  backup_name=$(basename -- "$canonical_backup")
  case "$canonical_backup" in
    "$canonical_backup_dir"/sqlite_*.db) ;;
    *)
      log "Refusing database restore outside $BACKUP_DIR or from a non-sqlite backup name."
      return 1
      ;;
  esac
  [[ "$backup_name" =~ ^sqlite_[A-Za-z0-9._-]+\.db$ ]] || {
    log "Refusing database restore from an unsafe backup filename."
    return 1
  }
  stop_and_confirm_service_inactive || return 1
  sudo rm -f -- "${DB_PATH}-wal" "${DB_PATH}-shm" || return 1
  sudo sqlite3 "$DB_PATH" ".restore '$canonical_backup'" || return 1
  [ "$(sudo sqlite3 "$DB_PATH" "PRAGMA integrity_check;")" = "ok" ] || return 1
  sudo chown kotoba:kotoba "$DB_PATH" || return 1
  sudo chmod 0640 "$DB_PATH" || return 1
}

quarantine_release() {
  local release_dir="$1"
  local failed_dir
  case "$release_dir" in
    "$RELEASES_DIR"/kotoba-*) ;;
    *) return 1 ;;
  esac
  failed_dir="$RELEASES_DIR/.failed-$(basename "$release_dir")-$(date +%Y%m%d%H%M%S)"
  sudo mv "$release_dir" "$failed_dir"
  log "Quarantined failed release at $failed_dir"
}

cleanup_failed_initial_activation() {
  local current release_dir="$1"
  stop_and_confirm_service_inactive || {
    log "Initial release failed and kotoba could not be proven inactive; maintenance mode remains active."
    return 1
  }
  sudo systemctl disable kotoba || return 1
  current=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)
  if [ "$current" = "$release_dir" ]; then
    sudo rm -f -- "$CURRENT_LINK" || return 1
  fi
  quarantine_release "$release_dir"
}

recover_active_release_after_stop_failure() {
  local release_dir="$1"
  activate_release "$release_dir" || return 1
  leave_maintenance
}

recover_previous_release() {
  local previous="$1"
  local backup_path="$2"
  local failed_release="$3"
  log "Restoring the pre-deploy database snapshot and previous release."
  restore_database "$backup_path" ||
    die "EMERGENCY: database restore failed. Maintenance mode remains active; use $backup_path for manual recovery."
  activate_release "$previous" || die "Automatic rollback failed; inspect systemd, nginx, and $backup_path."
  quarantine_release "$failed_release" || true
  leave_maintenance
}

enter_maintenance() {
  if sudo test -L "$APP_BASE/maintenance"; then
    log "Maintenance marker must not be a symbolic link."
    return 1
  fi
  if sudo test -e "$APP_BASE/maintenance"; then
    sudo test -f "$APP_BASE/maintenance" || return 1
  else
    sudo sh -c 'set -C; : > "$1"' sh "$APP_BASE/maintenance" || return 1
  fi
  sudo chmod 0644 "$APP_BASE/maintenance" || return 1
}

leave_maintenance() {
  sudo rm -f -- "$APP_BASE/maintenance"
}

cleanup_versions() {
  local current candidate count oldest
  current=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)

  while IFS= read -r candidate; do
    [ "$candidate" = "$current" ] && continue
    [ -f "$candidate/.release-healthy" ] && continue
    remove_incomplete_release "$candidate"
  done < <(find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -name 'kotoba-*' -print)

  count=$(find "$RELEASES_DIR" -mindepth 2 -maxdepth 2 -type f -name '.release-healthy' | wc -l)
  while [ "$count" -gt "$KEEP_VERSIONS" ]; do
    oldest=$(find "$RELEASES_DIR" -mindepth 2 -maxdepth 2 -type f -name '.release-healthy' -printf '%T@ %h\n' |
      sort -n | cut -d' ' -f2- | grep -Fvx "$current" | head -1 || true)
    [ -n "$oldest" ] || break
    remove_incomplete_release "$oldest"
    count=$((count - 1))
  done
  sudo find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -name '.failed-kotoba-*' -mtime +7 -exec rm -rf -- {} +
}

read_root_crontab_snapshot() {
  local destination="$1"
  local error_file="${destination}.error"
  local rc=0
  LC_ALL=C sudo crontab -l > "$destination" 2> "$error_file" || rc=$?
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

install_backup_schedule() {
  local current_root schedule_tmp rc=0
  current_root=$(mktemp) || return 1
  schedule_tmp=$(mktemp) || {
    rm -f -- "$current_root"
    return 1
  }
  if ! read_root_crontab_snapshot "$current_root"; then
    rm -f -- "$current_root" "$schedule_tmp"
    return 1
  fi
  awk '!/kotoba.*backup\.sh/' "$current_root" > "$schedule_tmp" || {
    rm -f -- "$current_root" "$schedule_tmp"
    return 1
  }
  printf '0 3 * * * env APP_BASE=%q bash %q/future/backup.sh\n' \
    "$APP_BASE" "$CURRENT_LINK" >> "$schedule_tmp" || rc=1
  if [ "$rc" -eq 0 ]; then
    sudo crontab "$schedule_tmp" || rc=$?
  fi
  rm -f -- "$current_root" "$schedule_tmp" || {
    [ "$rc" -ne 0 ] || rc=1
  }
  return "$rc"
}

case "${1:-}" in
  init)
    require_keep_versions
    require_unprivileged_operator
    require_supported_topology || die "Unsupported deployment topology."
    require_repo_url
    ensure_bun
    ensure_layout
    acquire_deploy_lock
    require_existing_nginx_site_compatible || die "Existing nginx site requires a manual safety merge."
    if ensure_env_file; then
      :
    else
      rc=$?
      [ "$rc" -eq 2 ] && exit 0
      exit "$rc"
    fi
    ref=$(require_deploy_ref)
    log "Preparing initial release from explicit ref: $ref"
    prepare_release "$ref" >/dev/null || die "Release preparation failed."
    release_dir="$PREPARED_RELEASE_DIR"
    enter_maintenance || die "Could not enable maintenance mode."
    run_migrations "$release_dir" || {
      quarantine_release "$release_dir" || true
      die "Initial database migration failed."
    }
    activate_release "$release_dir" || {
      cleanup_failed_initial_activation "$release_dir" ||
        die "Initial release failed and automatic cleanup was incomplete; maintenance mode remains active."
      die "Initial release failed readiness checks."
    }
    install_backup_schedule ||
      die "Initial release is healthy but backup schedule installation failed; maintenance remains active."
    leave_maintenance
    log "Deployed $ref. Configure the domain and TLS before opening traffic."
    ;;

  update)
    require_keep_versions
    require_unprivileged_operator
    require_supported_topology || die "Unsupported deployment topology."
    require_repo_url
    ensure_bun
    ensure_layout
    acquire_deploy_lock
    require_existing_nginx_site_compatible || die "Existing nginx site requires a manual safety merge."
    if ensure_env_file; then
      :
    else
      rc=$?
      [ "$rc" -eq 2 ] && exit 0
      exit "$rc"
    fi
    [ -L "$CURRENT_LINK" ] || die "Not deployed yet. Run: KOTOBA_REF=<tag-or-sha> future/deploy.sh init"
    previous=$(readlink -f "$CURRENT_LINK")
    ref=$(require_deploy_ref)
    log "Preparing update from explicit ref: $ref"
    prepare_release "$ref" >/dev/null || die "Release preparation failed; the active release was not changed."
    release_dir="$PREPARED_RELEASE_DIR"
    enter_maintenance || {
      quarantine_release "$release_dir" || true
      die "Could not enable maintenance mode."
    }
    stop_and_confirm_service_inactive || {
      if ! recover_active_release_after_stop_failure "$previous"; then
        quarantine_release "$release_dir" || true
        die "Could not stop the active service and the previous revision failed readiness; maintenance mode remains active."
      fi
      quarantine_release "$release_dir" || true
      die "Could not stop the active service; the previous revision was restarted and verified."
    }
    backup_path=$(backup_now "$release_dir") || {
      activate_release "$previous" || die "Backup failed and the previous service could not be restarted."
      leave_maintenance
      quarantine_release "$release_dir" || true
      die "Backup failed; restored the previous release."
    }
    if ! run_migrations "$release_dir"; then
      recover_previous_release "$previous" "$backup_path" "$release_dir"
      die "Migration failed; restored the previous release."
    fi
    if ! activate_release "$release_dir"; then
      recover_previous_release "$previous" "$backup_path" "$release_dir"
      die "Readiness failed; restored the previous release."
    fi
    leave_maintenance
    cleanup_versions
    log "Updated to $ref"
    ;;

  rollback)
    require_keep_versions
    require_unprivileged_operator
    require_supported_topology || die "Unsupported deployment topology."
    ensure_bun
    ensure_layout
    acquire_deploy_lock
    require_existing_nginx_site_compatible || die "Existing nginx site requires a manual safety merge."
    [ -L "$CURRENT_LINK" ] || die "Not deployed."
    current=$(readlink -f "$CURRENT_LINK")
    previous=$(find_previous_healthy_release "$current")
    [ -n "$previous" ] || die "No previous successful release found."
    enter_maintenance || die "Could not enable maintenance mode."
    stop_and_confirm_service_inactive || {
      recover_active_release_after_stop_failure "$current" ||
        die "Could not stop the current service and its revision failed readiness; maintenance mode remains active."
      die "Could not stop the current service; its revision was restarted and verified."
    }
    backup_now "$current" >/dev/null || {
      activate_release "$current" || die "Backup failed and the current service could not be restarted."
      leave_maintenance
      die "Backup failed; rollback was not attempted."
    }
    if ! activate_release "$previous"; then
      activate_release "$current" || die "Rollback and recovery both failed; manual intervention is required."
      leave_maintenance
      die "Requested rollback failed; restored the current release."
    fi
    leave_maintenance
    log "Rolled back to $(basename "$previous"). Database migrations remain forward-only."
    ;;

  list)
    find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d \
      \( -name 'kotoba-*' -o -name '.failed-kotoba-*' \) \
      -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | sort -r || true
    ;;

  *)
    printf 'Usage: %s {init|update|rollback|list}\n' "$0"
    printf 'Deploy: KOTOBA_REPO_URL=<url> KOTOBA_REF=<reviewed-tag-or-sha> %s init|update\n' "$0"
    printf 'Optional: APP_BASE, KEEP_VERSIONS, KOTOBA_HEALTH_URL, KOTOBA_ROOT_URL\n'
    exit 1
    ;;
esac
