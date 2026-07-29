import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";

const BASH = process.platform === "win32"
  ? "C:\\Program Files\\Git\\bin\\bash.exe"
  : "bash";

async function runBash(script: string) {
  if (!existsSync(BASH) && process.platform === "win32") {
    throw new Error(`Git Bash not found at ${BASH}`);
  }

  const child = Bun.spawn({
    cmd: [BASH, "-lc", script],
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

const SOURCE_DEPLOY_FUNCTIONS = String.raw`
source <(sed '/^case "\${1:-}" in/,$d' future/deploy.sh)
`;

describe("production shell scripts", () => {
  it("parse as valid Bash", async () => {
    const result = await runBash("bash -n future/deploy.sh && bash -n future/backup.sh");
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("requires an explicit reviewed tag or commit for every deployment", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
if (
  unset KOTOBA_REF
  require_deploy_ref
); then
  printf 'missing KOTOBA_REF was accepted\n' >&2
  exit 40
fi
KOTOBA_REF="v2.1.2"
[ "$(require_deploy_ref)" = "v2.1.2" ]
if (
  KOTOBA_REF="main"
  require_deploy_ref
); then
  printf 'mutable branch ref was accepted\n' >&2
  exit 41
fi
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("pins the deployment runtime instead of accepting an environment override", async () => {
    const deploy = await Bun.file("future/deploy.sh").text();
    expect(deploy).toContain('BUN_VERSION="1.3.11"');
    expect(deploy).not.toContain("KOTOBA_BUN_VERSION");
  });

  it("rejects invalid KEEP_VERSIONS values before deployment mutates the host", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
declare -F require_keep_versions >/dev/null
for invalid in 0 -1 1.5 three ""; do
  if (
    KEEP_VERSIONS="$invalid"
    require_keep_versions
  ); then
    printf 'invalid KEEP_VERSIONS was accepted: %s\n' "$invalid" >&2
    exit 41
  fi
done
(
  KEEP_VERSIONS=1
  require_keep_versions
)
`);
    expect(result.exitCode, result.stderr).toBe(0);

    const deploy = await Bun.file("future/deploy.sh").text();
    for (const command of ["init", "update", "rollback"]) {
      const block = deploy
        .split(new RegExp(`\\n  ${command}\\)`))[1]
        ?.split(/\n  [a-z*]+\)/)[0] ?? "";
      const validation = block.indexOf("require_keep_versions");
      const layout = block.indexOf("ensure_layout");
      expect(validation).toBeGreaterThanOrEqual(0);
      expect(layout).toBeGreaterThan(validation);
    }
  }, 15_000);

  it("does not reinstall Bun when the pinned binary is already the install target", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
bun() {
  [ "$1" = "--version" ]
  printf '%s\n' "$BUN_VERSION"
}
command() {
  if [ "$1" = "-v" ] && [ "$2" = "bun" ]; then
    printf '/usr/local/bin/bun\n'
    return 0
  fi
  builtin command "$@"
}
sudo() {
  if [ "$1" = "install" ]; then
    printf 'attempted same-file Bun installation\n' >&2
    return 41
  fi
  "$@"
}

ensure_bun
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("prepare_release prints only the prepared directory", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
operator_home="$tmp/operator-home"
mkdir -p "$operator_home/.ssh"
: > "$operator_home/.ssh/deploy-key"
export HOME="$operator_home"
RELEASES_DIR="$tmp/releases"
SHARED_DIR="$tmp/shared"
ENV_FILE="$SHARED_DIR/.env"
DB_PATH="$SHARED_DIR/sqlite.db"
UPLOAD_DIR="$SHARED_DIR/uploads"
REPO_URL="example.invalid/repo.git"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR"
: > "$ENV_FILE"

git() {
  if [ "$1" = "clone" ]; then
    mkdir -p "$3"
  fi
}
command() {
  if [ "$1" = "-v" ] && { [ "$2" = "pkill" ] || [ "$2" = "pgrep" ]; }; then
    printf '%s\n' "$2"
    return 0
  fi
  builtin command "$@"
}
sudo() {
  if [ "$1" = "-u" ]; then
    [ "$2" = "$BUILD_USER" ] && [ "$3" = "env" ] && [ "$4" = "-i" ]
    case " $* " in
      *server-secret*|*captcha-secret*|*cloud-secret*|*github-secret*|*agent.sock*)
        printf 'isolated build command received a protected value\n' >&2
        return 57
        ;;
    esac
    return 0
  fi
  if [ "$1" = "pkill" ] || [ "$1" = "pgrep" ]; then
    return 1
  fi
  if [ "$1" = "install" ]; then
    local install_arg install_target=""
    for install_arg in "$@"; do
      install_target="$install_arg"
    done
    mkdir -p "$install_target"
    return 0
  fi
  if [ "$1" = "chown" ] || [ "$1" = "chmod" ]; then
    return 0
  fi
  "$@"
}
bun() {
  if [ "$HOME" = "$operator_home" ] || [ -e "$HOME/.ssh/deploy-key" ]; then
    printf 'build inherited the deployment operator home\n' >&2
    return 58
  fi
  if env | grep -Eq '^(COOKIE_SECRET|TURNSTILE_SECRET|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|SSH_AUTH_SOCK)='; then
    printf 'build inherited a protected environment variable\n' >&2
    return 57
  fi
  printf 'simulated bun output\n'
}

export COOKIE_SECRET="server-secret"
export TURNSTILE_SECRET="captcha-secret"
export AWS_SECRET_ACCESS_KEY="cloud-secret"
export GITHUB_TOKEN="github-secret"
export SSH_AUTH_SOCK="/tmp/agent.sock"
out="$(prepare_release main)"
lines="$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
[ "$lines" = "1" ] || {
  printf 'prepare_release returned %s lines:\n%s\n' "$lines" "$out" >&2
  exit 41
}
case "$out" in
  "$RELEASES_DIR"/kotoba-main-*) ;;
  *) printf 'unexpected release path: %s\n' "$out" >&2; exit 42 ;;
esac
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("selects rollback targets only from releases that passed readiness", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
RELEASES_DIR="$tmp/releases"
mkdir -p "$RELEASES_DIR/current" "$RELEASES_DIR/prepared" "$RELEASES_DIR/healthy-old" "$RELEASES_DIR/healthy-new"
: > "$RELEASES_DIR/current/.release-healthy"
: > "$RELEASES_DIR/healthy-old/.release-healthy"
: > "$RELEASES_DIR/healthy-new/.release-healthy"
touch -t 202601010101 "$RELEASES_DIR/healthy-old/.release-healthy"
touch -t 202602020202 "$RELEASES_DIR/healthy-new/.release-healthy"

selected="$(find_previous_healthy_release "$RELEASES_DIR/current")"
[ "$selected" = "$RELEASES_DIR/healthy-new" ] || {
  printf 'unexpected rollback target: %s\n' "$selected" >&2
  exit 41
}
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("rejects custom production topology paths that the systemd template cannot honor", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
declare -F require_supported_topology >/dev/null
KOTOBA_SHARED_DIR="/srv/other-data"
if require_supported_topology; then
  printf 'unsupported custom shared path was accepted\n' >&2
  exit 41
fi
unset KOTOBA_SHARED_DIR
for unsafe in \
  "/home/deploy/kotoba" \
  "/etc/kotoba" \
  "/opt/kotoba bad" \
  "/opt/kotoba&bad" \
  "/opt/kotoba%bad" \
  "/opt/kotoba/../other"; do
  if (
    APP_BASE="$unsafe"
    require_supported_topology
  ); then
    printf 'unsafe APP_BASE was accepted: %s\n' "$unsafe" >&2
    exit 42
  fi
done
(
  APP_BASE="/srv/kotoba"
  require_supported_topology
)
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("rejects unsafe backup base paths before creating any directory", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unsafe="$tmp/unsafe path"
if APP_BASE="$unsafe" bash future/backup.sh; then
  printf 'unsafe backup APP_BASE unexpectedly succeeded\n' >&2
  exit 41
fi
[ ! -e "$unsafe/backups" ] || {
  printf 'unsafe backup path was used before validation\n' >&2
  exit 42
}
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("requires an existing operator nginx site to contain the deployment safety hooks", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf 'server { location / { proxy_pass http://127.0.0.1:3000; } }\n' > "$tmp/unsafe.conf"
if validate_nginx_site_file "$tmp/unsafe.conf"; then
  printf 'unsafe existing nginx site was accepted\n' >&2
  exit 41
fi
cat > "$tmp/safe.conf" <<'NGINX'
server {
  if (-f /opt/kotoba/maintenance) { return 503; }
  location /api/events {
    limit_req zone=api_perip burst=10 nodelay;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_cache off;
  }
  location /api/ {
    limit_req zone=api_perip burst=60 nodelay;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
NGINX
if validate_nginx_site_file "$tmp/safe.conf"; then
  printf 'SSE site without a long read timeout was accepted\n' >&2
  exit 42
fi
sed -i '/proxy_cache off;/a\\    proxy_read_timeout 1h;' "$tmp/safe.conf"
validate_nginx_site_file "$tmp/safe.conf"
cp "$tmp/safe.conf" "$tmp/large-safe.conf"
head -c 1048576 /dev/zero | tr '\0' 'x' >> "$tmp/large-safe.conf"
validate_nginx_site_file "$tmp/large-safe.conf"
sed -i '/location \\/api\\/ {/,/}/ { /X-Real-IP/d; }' "$tmp/safe.conf"
if validate_nginx_site_file "$tmp/safe.conf"; then
  printf 'ordinary API location without trusted client IP was accepted\n' >&2
  exit 43
fi
cat > "$tmp/nested-maintenance.conf" <<'NGINX'
server {
  location = /maintenance-check {
    if (-f /opt/kotoba/maintenance) { return 503; }
  }
  location /api/events {
    limit_req zone=api_perip burst=10 nodelay;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
  }
  location /api/ {
    limit_req zone=api_perip burst=60 nodelay;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
NGINX
if validate_nginx_site_file "$tmp/nested-maintenance.conf"; then
  printf 'location-scoped maintenance guard was accepted as a server guard\n' >&2
  exit 44
fi
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("propagates release build failures and never reports a prepared directory", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
RELEASES_DIR="$tmp/releases"
SHARED_DIR="$tmp/shared"
ENV_FILE="$SHARED_DIR/.env"
REPO_URL="example.invalid/repo.git"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR"
: > "$ENV_FILE"

git() {
  if [ "$1" = "clone" ]; then
    mkdir -p "$3"
    return 0
  fi
  if [ "$1" = "-C" ] && [ "$3" = "rev-parse" ]; then
    printf '0123456789abcdef0123456789abcdef01234567\n'
    return 0
  fi
  return 0
}
command() {
  if [ "$1" = "-v" ] && { [ "$2" = "pkill" ] || [ "$2" = "pgrep" ]; }; then
    printf '%s\n' "$2"
    return 0
  fi
  builtin command "$@"
}
sudo() {
  if [ "$1" = "-u" ]; then
    return 27
  fi
  if [ "$1" = "pkill" ] || [ "$1" = "pgrep" ]; then
    return 1
  fi
  if [ "$1" = "chown" ] || [ "$1" = "chmod" ]; then
    return 0
  fi
  "$@"
}
bun() {
  if [ "$1" = "run" ] && [ "$2" = "--cwd" ] && [ "$4" = "build" ]; then
    printf 'simulated build failure\n' >&2
    return 27
  fi
  return 0
}

if out="$(prepare_release v2.1.2)"; then
  printf 'failed build was accepted: %s\n' "$out" >&2
  exit 41
fi
[ -z "$out" ]
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("forces both database and upload paths into shared storage", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
SHARED_DIR="$tmp/shared"
ENV_FILE="$SHARED_DIR/.env"
DB_PATH="$SHARED_DIR/sqlite.db"
UPLOAD_DIR="$SHARED_DIR/uploads"
mkdir -p "$SHARED_DIR"
cat > "$ENV_FILE" <<'ENV'
COOKIE_SECRET=0123456789abcdef0123456789abcdef
TURNSTILE_SECRET=real-turnstile-secret
VITE_TURNSTILE_SITEKEY=real-turnstile-site-key
VITE_MOBILE_ROUTES_ENABLED=true
DB_PATH=sqlite.db
UPLOAD_DIR=uploads
UPLOAD_MAX_BYTES=5368709120
ENV
sudo() { "$@"; }

ensure_env_file
grep -Fx "DB_PATH=$DB_PATH" "$ENV_FILE"
grep -Fx "UPLOAD_DIR=$UPLOAD_DIR" "$ENV_FILE"
grep -Fx "NODE_ENV=production" "$ENV_FILE"
grep -Fx "HOST=127.0.0.1" "$ENV_FILE"
grep -Fx "PORT=3000" "$ENV_FILE"
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("rejects weak cookie secrets and production Turnstile test keys", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
sudo() { "$@"; }

expect_invalid() {
  local cookie_secret="$1"
  local server_key="$2"
  local site_key="$3"
  local case_dir="$tmp/$4"
  mkdir -p "$case_dir"
  if (
    SHARED_DIR="$case_dir"
    ENV_FILE="$case_dir/.env"
    DB_PATH="$case_dir/sqlite.db"
    UPLOAD_DIR="$case_dir/uploads"
    cat > "$ENV_FILE" <<ENV
COOKIE_SECRET=$cookie_secret
TURNSTILE_SECRET=$server_key
VITE_TURNSTILE_SITEKEY=$site_key
VITE_MOBILE_ROUTES_ENABLED=true
DB_PATH=sqlite.db
UPLOAD_DIR=uploads
UPLOAD_MAX_BYTES=5368709120
ENV
    ensure_env_file
  ); then
    printf 'invalid configuration unexpectedly accepted: %s\n' "$4" >&2
    return 1
  fi
  return 0
}

expect_invalid "short" "real-server-key" "real-site-key" weak-cookie
expect_invalid "0123456789abcdef0123456789abcdef" \
  "1x0000000000000000000000000000000AA" "real-site-key" server-test-key
expect_invalid "0123456789abcdef0123456789abcdef" \
  "real-server-key" "1x00000000000000000000AA" client-test-key
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("rejects ambiguous EnvironmentFile syntax, duplicate keys, and deployment-only overrides", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
DB_PATH="$tmp/shared/data/sqlite.db"
UPLOAD_DIR="$tmp/shared/uploads"
mkdir -p "$(dirname "$DB_PATH")" "$UPLOAD_DIR"
sudo() { "$@"; }

write_valid_env() {
  local target="$1"
  cat > "$target" <<ENV
COOKIE_SECRET=0123456789abcdef0123456789abcdef
TURNSTILE_SECRET=real-turnstile-secret
VITE_TURNSTILE_SITEKEY=real-turnstile-site-key
VITE_MOBILE_ROUTES_ENABLED=true
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_PATH=$DB_PATH
UPLOAD_DIR=$UPLOAD_DIR
UPLOAD_MAX_BYTES=5368709120
ENV
}

expect_invalid_env() {
  local case_name="$1"
  ENV_FILE="$tmp/$case_name.env"
  write_valid_env "$ENV_FILE"
  shift
  "$@" "$ENV_FILE"
  if (validate_env_file); then
    printf 'invalid EnvironmentFile was accepted: %s\n' "$case_name" >&2
    return 1
  fi
}

quote_secret() { sed -i 's/^COOKIE_SECRET=.*/COOKIE_SECRET="0123456789abcdef0123456789abcdef"/' "$1"; }
leading_value() { sed -i 's/^TURNSTILE_SECRET=/TURNSTILE_SECRET= /' "$1"; }
trailing_value() { sed -i 's/^VITE_TURNSTILE_SITEKEY=.*/VITE_TURNSTILE_SITEKEY=real-site-key /' "$1"; }
backslash_value() { printf 'EXTRA_VALUE=real\\secret\n' >> "$1"; }
duplicate_port() { printf 'PORT=3000\n' >> "$1"; }
reserved_revision() { printf 'KOTOBA_REVISION=spoofed\n' >> "$1"; }
reserved_test_db() { printf 'TEST_DB=1\n' >> "$1"; }
unsafe_topology() { printf 'APP_BASE=/srv/other\n' >> "$1"; }
leading_key_space() { sed -i 's/^HOST=/ HOST=/' "$1"; }
preload_override() { printf 'LD_PRELOAD=/tmp/evil.so\n' >> "$1"; }
unknown_key() { printf 'UNREVIEWED_RUNTIME_OPTION=1\n' >> "$1"; }

expect_invalid_env quoted-value quote_secret
expect_invalid_env leading-value leading_value
expect_invalid_env trailing-value trailing_value
expect_invalid_env escaped-value backslash_value
expect_invalid_env duplicate-key duplicate_port
expect_invalid_env reserved-revision reserved_revision
expect_invalid_env reserved-test-db reserved_test_db
expect_invalid_env topology-override unsafe_topology
expect_invalid_env leading-key-space leading_key_space
expect_invalid_env preload-override preload_override
expect_invalid_env unknown-key unknown_key
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("requires exact production topology values and a boolean mobile route flag", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
DB_PATH="$tmp/shared/data/sqlite.db"
UPLOAD_DIR="$tmp/shared/uploads"
mkdir -p "$(dirname "$DB_PATH")" "$UPLOAD_DIR"
sudo() { "$@"; }

write_valid_env() {
  cat > "$ENV_FILE" <<ENV
COOKIE_SECRET=0123456789abcdef0123456789abcdef
TURNSTILE_SECRET=real-turnstile-secret
VITE_TURNSTILE_SITEKEY=real-turnstile-site-key
VITE_MOBILE_ROUTES_ENABLED=true
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_PATH=$DB_PATH
UPLOAD_DIR=$UPLOAD_DIR
UPLOAD_MAX_BYTES=5368709120
ENV
}

expect_invalid_value() {
  local key="$1"
  local invalid="$2"
  ENV_FILE="$tmp/$key.env"
  write_valid_env
  sed -i "s|^$key=.*|$key=$invalid|" "$ENV_FILE"
  if (validate_env_file); then
    printf 'invalid %s value was accepted: %s\n' "$key" "$invalid" >&2
    return 1
  fi
}

ENV_FILE="$tmp/valid.env"
write_valid_env
validate_env_file
expect_invalid_value NODE_ENV development
expect_invalid_value HOST 0.0.0.0
expect_invalid_value PORT 4000
expect_invalid_value DB_PATH "$tmp/other.db"
expect_invalid_value UPLOAD_DIR "$tmp/other-uploads"
expect_invalid_value VITE_MOBILE_ROUTES_ENABLED yes
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("passes the held deploy lock marker into the coordinated backup", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
APP_BASE="$tmp/app"
release_dir="$tmp/release"
mkdir -p "$release_dir/future"
: > "$release_dir/future/backup.sh"

sudo() {
  printf '%s\n' "$*" > "$tmp/sudo-args"
}

backup_now "$release_dir"
grep -F "env APP_BASE=$APP_BASE KOTOBA_DEPLOY_LOCK_HELD=1 bash $release_dir/future/backup.sh" "$tmp/sudo-args"
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("accepts health only when top-level readiness, version, and revision all match exactly", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
BUN_BIN="$(command -v bun)"
expected_version="2.1.2"
expected_revision="0123456789abcdef0123456789abcdef01234567"

health_response_matches \
  '{"success":true,"status":"ready","version":"2.1.2","revision":"0123456789abcdef0123456789abcdef01234567"}' \
  "$expected_version" "$expected_revision"

for unsafe in \
  '{"success":false,"status":"ready","version":"2.1.2","revision":"0123456789abcdef0123456789abcdef01234567"}' \
  '{"success":true,"status":"not-ready","version":"2.1.2","revision":"0123456789abcdef0123456789abcdef01234567"}' \
  '{"success":true,"status":"ready","version":"2.1.1","revision":"0123456789abcdef0123456789abcdef01234567"}' \
  '{"success":true,"status":"ready","version":"2.1.2","revision":"0123456789abcdef0123456789abcdef01234567-extra"}' \
  '{"success":true,"status":"ready","version":"2.1.2","revision":"prefix-0123456789abcdef0123456789abcdef01234567"}' \
  '{"success":true,"status":"ready","version":"2.1.2","revision":"0123456789abcdef0123456789abcdef01234567"'; do
  if health_response_matches "$unsafe" "$expected_version" "$expected_revision"; then
    printf 'unsafe health response was accepted: %s\n' "$unsafe" >&2
    exit 41
  fi
done
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

    const deploy = await Bun.file("future/deploy.sh").text();
    const waitStart = deploy.indexOf("wait_for_health() {");
    const waitEnd = deploy.indexOf("\nactivate_release() {", waitStart);
    const wait = deploy.slice(waitStart, waitEnd);
    expect(wait).toContain("health_response_matches");
  }, 15_000);

  it("keeps http-scope nginx zones outside the server block", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
! grep -q 'limit_conn_zone' future/nginx.conf
grep -Eq '^[[:space:]]*limit_conn_zone[[:space:]]' future/nginx-limits.conf
grep -Eq '^[[:space:]]*limit_req_zone[[:space:]]' future/nginx-limits.conf
`);
    expect(result.exitCode, result.stderr).toBe(0);
  }, 15_000);

  it("restricts the service write surface to data and uploads", async () => {
    const service = await Bun.file("future/kotoba.service").text();
    expect(service).toContain("EnvironmentFile=/opt/kotoba/config/kotoba.env");
    expect(service).toContain("ReadWritePaths=/opt/kotoba/shared/data /opt/kotoba/shared/uploads");
    expect(service).toContain("InaccessiblePaths=/opt/kotoba/backups");
    expect(service).not.toContain("ReadWritePaths=/opt/kotoba/shared\n");
  });

  it("enters maintenance and stops writes before taking the update backup", async () => {
    const updateBlock = (await Bun.file("future/deploy.sh").text())
      .split(/\n  update\)/)[1]
      ?.split(/\n  rollback\)/)[0] ?? "";
    expect(updateBlock.indexOf("enter_maintenance")).toBeGreaterThanOrEqual(0);
    expect(updateBlock.indexOf("stop_and_confirm_service_inactive")).toBeGreaterThan(updateBlock.indexOf("enter_maintenance"));
    expect(updateBlock.indexOf('backup_now "$release_dir"')).toBeGreaterThan(updateBlock.indexOf("stop_and_confirm_service_inactive"));
    expect(updateBlock).not.toContain('$CURRENT_LINK/future/backup.sh');
  });

  it("installs the initial backup schedule before removing maintenance", async () => {
    const initBlock = (await Bun.file("future/deploy.sh").text())
      .split(/\n  init\)/)[1]
      ?.split(/\n  update\)/)[0] ?? "";
    const activation = initBlock.indexOf('activate_release "$release_dir"');
    const schedule = initBlock.indexOf("install_backup_schedule");
    const leaveMaintenance = initBlock.indexOf("leave_maintenance");

    expect(activation).toBeGreaterThanOrEqual(0);
    expect(schedule).toBeGreaterThan(activation);
    expect(leaveMaintenance).toBeGreaterThan(schedule);
    expect(initBlock).toContain("maintenance remains active");
  });

  it("does not replace root cron when the existing schedule cannot be read", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
APP_BASE="$tmp/app"
CURRENT_LINK="$APP_BASE/current"
mkdir -p "$APP_BASE"
export CRON_MUTATED="$tmp/cron-mutated"

sudo() {
  if [ "$1" = "crontab" ] && [ "$2" = "-l" ]; then
    printf 'permission denied\n' >&2
    return 55
  fi
  if [ "$1" = "crontab" ]; then
    : > "$CRON_MUTATED"
    return 0
  fi
  "$@"
}

if install_backup_schedule; then
  printf 'unexpected crontab read failure was treated as empty\n' >&2
  exit 40
fi
[ ! -e "$CRON_MUTATED" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("creates maintenance without following a pre-existing symlink", async () => {
    const deploy = await Bun.file("future/deploy.sh").text();
    const maintenance = deploy.slice(
      deploy.indexOf("enter_maintenance() {"),
      deploy.indexOf("leave_maintenance() {"),
    );
    expect(maintenance).toContain('sudo test -L "$APP_BASE/maintenance"');
    expect(maintenance).toContain("set -C");
    expect(maintenance).not.toContain("sudo touch");
  });

  it("never restores a database unless systemd confirms the service stopped", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
DB_PATH="$tmp/sqlite.db"
BACKUP_DIR="$tmp/backups"
mkdir -p "$BACKUP_DIR"
: > "$DB_PATH"
: > "$BACKUP_DIR/sqlite_stop-check.db"

sudo() {
  if [ "$1" = "test" ] || [ "$1" = "realpath" ]; then
    shift
    "$@"
    return
  fi
  if [ "$1" = "systemctl" ] && [ "$2" = "stop" ]; then
    return 1
  fi
  if [ "$1" = "rm" ] || [ "$1" = "sqlite3" ]; then
    : > "$tmp/database-touched"
    [ "$1" != "sqlite3" ] || printf 'ok\n'
    return 0
  fi
  return 0
}

if restore_database "$BACKUP_DIR/sqlite_stop-check.db"; then
  printf 'restore succeeded after systemctl stop failed\n' >&2
  exit 41
fi
[ ! -e "$tmp/database-touched" ] || {
  printf 'database was touched after systemctl stop failed\n' >&2
  exit 42
}

sudo() {
  if [ "$1" = "test" ] || [ "$1" = "realpath" ]; then
    shift
    "$@"
    return
  fi
  if [ "$1" = "systemctl" ] && [ "$2" = "stop" ]; then
    return 0
  fi
  if [ "$1" = "systemctl" ] && [ "$2" = "is-active" ]; then
    return 0
  fi
  if [ "$1" = "rm" ] || [ "$1" = "sqlite3" ]; then
    : > "$tmp/database-touched"
    [ "$1" != "sqlite3" ] || printf 'ok\n'
    return 0
  fi
  return 0
}

if restore_database "$BACKUP_DIR/sqlite_stop-check.db"; then
  printf 'restore succeeded while service still reported active\n' >&2
  exit 43
fi
[ ! -e "$tmp/database-touched" ]

sudo() {
  if [ "$1" = "test" ] || [ "$1" = "realpath" ]; then
    shift
    "$@"
    return
  fi
  if [ "$1" = "systemctl" ] && [ "$2" = "stop" ]; then
    return 0
  fi
  if [ "$1" = "systemctl" ] && [ "$2" = "is-active" ]; then
    return 4
  fi
  if [ "$1" = "rm" ] || [ "$1" = "sqlite3" ]; then
    : > "$tmp/database-touched"
    [ "$1" != "sqlite3" ] || printf 'ok\n'
    return 0
  fi
  return 0
}

if restore_database "$BACKUP_DIR/sqlite_stop-check.db"; then
  printf 'restore succeeded while service state was indeterminate\n' >&2
  exit 44
fi
[ ! -e "$tmp/database-touched" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("accepts only systemd's exact inactive state before destructive work", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
declare -F stop_and_confirm_service_inactive >/dev/null
mock_state_rc=4
sudo() {
  if [ "$1" = "systemctl" ] && [ "$2" = "stop" ]; then
    return 0
  fi
  if [ "$1" = "systemctl" ] && [ "$2" = "is-active" ]; then
    return "$mock_state_rc"
  fi
  return 1
}

if stop_and_confirm_service_inactive; then
  printf 'indeterminate systemd state was accepted as inactive\n' >&2
  exit 40
fi
mock_state_rc=3
stop_and_confirm_service_inactive
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("restores root-only backup files through sudo after canonical path validation", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
DB_PATH="$tmp/sqlite.db"
BACKUP_DIR="/root/kotoba-backups"
backup_path="$BACKUP_DIR/sqlite_20260729_010203.db"
: > "$DB_PATH"

sudo() {
  case "$1" in
    test)
      [ "$2" = "-f" ] && [ "$3" = "$backup_path" ]
      ;;
    realpath)
      [ "$2" = "-e" ] && [ "$3" = "--" ]
      case "$4" in
        "$BACKUP_DIR"|"$backup_path") printf '%s\n' "$4" ;;
        *) return 1 ;;
      esac
      ;;
    systemctl)
      [ "$2" = "stop" ] && return 0
      [ "$2" = "is-active" ] && return 3
      return 1
      ;;
    sqlite3)
      if [ "$3" = "PRAGMA integrity_check;" ]; then
        printf 'ok\n'
      else
        [ "$3" = ".restore '$backup_path'" ]
        : > "$tmp/restored"
      fi
      ;;
    rm|chown|chmod)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

restore_database "$backup_path"
[ -e "$tmp/restored" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("rejects restore sources outside BACKUP_DIR or without a sqlite backup name", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
DB_PATH="$tmp/sqlite.db"
BACKUP_DIR="$tmp/backups"
mkdir -p "$BACKUP_DIR" "$tmp/outside"
: > "$DB_PATH"
: > "$tmp/outside/sqlite_escaped.db"
: > "$BACKUP_DIR/manual.db"

sudo() {
  case "$1" in
    test|realpath)
      shift
      "$@"
      ;;
    systemctl)
      [ "$2" = "stop" ] && return 0
      [ "$2" = "is-active" ] && return 1
      return 1
      ;;
    sqlite3)
      : > "$tmp/database-touched"
      [ "$3" != "PRAGMA integrity_check;" ] || printf 'ok\n'
      ;;
    rm|chown|chmod)
      return 0
      ;;
    *)
      return 0
      ;;
  esac
}

for unsafe in "$tmp/outside/sqlite_escaped.db" "$BACKUP_DIR/manual.db"; do
  if restore_database "$unsafe"; then
    printf 'unsafe restore source was accepted: %s\n' "$unsafe" >&2
    exit 41
  fi
done
[ ! -e "$tmp/database-touched" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("cleans a failed initial activation without exposing a quarantined target", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
declare -F cleanup_failed_initial_activation >/dev/null
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
APP_BASE="$tmp/app"
RELEASES_DIR="$APP_BASE/releases"
CURRENT_LINK="$APP_BASE/current"
release_dir="$RELEASES_DIR/kotoba-v2.1.2-test"
mkdir -p "$release_dir"
: > "$APP_BASE/maintenance"
ln -s "$release_dir" "$CURRENT_LINK"

sudo() {
  if [ "$1" = "systemctl" ]; then
    [ "$2" = "stop" ] && : > "$tmp/service-stopped"
    [ "$2" = "is-active" ] && return 3
    return 0
  fi
  "$@"
}

cleanup_failed_initial_activation "$release_dir"
[ -e "$tmp/service-stopped" ]
[ ! -L "$CURRENT_LINK" ]
[ -e "$APP_BASE/maintenance" ]
[ ! -e "$release_dir" ]
find "$RELEASES_DIR" -maxdepth 1 -type d -name '.failed-kotoba-v2.1.2-test-*' | grep -q .
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

    const initBlock = (await Bun.file("future/deploy.sh").text())
      .split(/\n  init\)/)[1]
      ?.split(/\n  update\)/)[0] ?? "";
    expect(initBlock).toContain('cleanup_failed_initial_activation "$release_dir"');
  }, 15_000);

  it("keeps maintenance enabled after stop failure until the old revision is ready", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
declare -F recover_active_release_after_stop_failure >/dev/null
leave_maintenance() {
  : > "$tmp/maintenance-left"
}
activate_release() {
  return 1
}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if recover_active_release_after_stop_failure "/release/current"; then
  printf 'failed old revision readiness was accepted\n' >&2
  exit 41
fi
[ ! -e "$tmp/maintenance-left" ]

activate_release() {
  [ "$1" = "/release/current" ]
}
recover_active_release_after_stop_failure "/release/current"
[ -e "$tmp/maintenance-left" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

    const deploy = await Bun.file("future/deploy.sh").text();
    const updateBlock = deploy
      .split(/\n  update\)/)[1]
      ?.split(/\n  rollback\)/)[0] ?? "";
    const rollbackBlock = deploy
      .split(/\n  rollback\)/)[1]
      ?.split(/\n  list\)/)[0] ?? "";
    expect(updateBlock).toContain('recover_active_release_after_stop_failure "$previous"');
    expect(rollbackBlock).toContain('recover_active_release_after_stop_failure "$current"');
  }, 15_000);

  it("prunes interrupted candidates without sacrificing healthy rollback points", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
RELEASES_DIR="$tmp/releases"
CURRENT_LINK="$tmp/current"
KEEP_VERSIONS=2
mkdir -p "$RELEASES_DIR/kotoba-current" "$RELEASES_DIR/kotoba-healthy-old" "$RELEASES_DIR/kotoba-interrupted-new"
: > "$RELEASES_DIR/kotoba-current/.release-healthy"
: > "$RELEASES_DIR/kotoba-healthy-old/.release-healthy"
touch -d '3 days ago' "$RELEASES_DIR/kotoba-healthy-old" "$RELEASES_DIR/kotoba-healthy-old/.release-healthy"
touch -d '2 days ago' "$RELEASES_DIR/kotoba-current" "$RELEASES_DIR/kotoba-current/.release-healthy"
touch -d '1 day ago' "$RELEASES_DIR/kotoba-interrupted-new"
ln -s "$RELEASES_DIR/kotoba-current" "$CURRENT_LINK"
sudo() { "$@"; }

cleanup_versions
[ -d "$RELEASES_DIR/kotoba-current" ]
[ -d "$RELEASES_DIR/kotoba-healthy-old" ] || {
  printf 'healthy rollback point was deleted\n' >&2
  exit 41
}
[ ! -e "$RELEASES_DIR/kotoba-interrupted-new" ] || {
  printf 'interrupted candidate was retained\n' >&2
  exit 42
}
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("validates an existing nginx site before a rollback stops service", async () => {
    const rollbackBlock = (await Bun.file("future/deploy.sh").text())
      .split(/\n  rollback\)/)[1]
      ?.split(/\n  list\)/)[0] ?? "";
    const validation = rollbackBlock.indexOf("require_existing_nginx_site_compatible");
    const maintenance = rollbackBlock.indexOf("enter_maintenance");
    const stop = rollbackBlock.indexOf("stop_and_confirm_service_inactive");
    expect(validation).toBeGreaterThanOrEqual(0);
    expect(maintenance).toBeGreaterThan(validation);
    expect(stop).toBeGreaterThan(maintenance);
  });

  it("preserves operator-managed nginx site settings on updates", async () => {
    const deploy = await Bun.file("future/deploy.sh").text();
    expect(deploy).toContain('if ! sudo test -f "$NGINX_SITE_FILE"');
    expect(deploy).toContain("require_existing_nginx_site_compatible");
    expect(deploy).toContain("EMERGENCY: database restore failed");
    expect(deploy).toContain("flock -n 9");
    expect(deploy).toContain("require_unprivileged_operator");
    expect(deploy).toContain("mark_release_healthy");
    expect(await Bun.file("future/nginx.conf").text()).toContain("maintenance");
  });

  it("backs up and prunes environment snapshots with the other backup sets", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads" "$tmp/backups"
cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then
  printf 'ok\n'
  exit 0
fi
target=$(printf '%s\n' "$2" | sed -n "s/^\\.backup '\\(.*\\)'$/\\1/p")
[ -n "$target" ]
: > "$target"
STUB
chmod +x "$tmp/bin/flock" "$tmp/bin/sqlite3"
printf 'secret=value\n' > "$tmp/config/kotoba.env"
: > "$tmp/shared/data/sqlite.db"
: > "$tmp/backups/env_20000101_000000"
touch -d '20 days ago' "$tmp/backups/env_20000101_000000"

PATH="$tmp/bin:$PATH" \
NODE_ENV=test \
KOTOBA_TEST_ALLOW_NONSTANDARD_BASE=1 \
APP_BASE="$tmp" \
bash future/backup.sh

find "$tmp/backups" -name 'sqlite_*.db' -type f | grep -q .
find "$tmp/backups" -name 'env_*' -type f | grep -q .
find "$tmp/backups" -name 'uploads_*.tar.gz' -type f | grep -q .
find "$tmp/backups" -name 'manifest_*.sha256' -type f | grep -q .
[ ! -e "$tmp/backups/env_20000101_000000" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("refuses to publish an incomplete backup set when env or uploads are missing", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/case-env/config" "$tmp/case-env/shared/data" "$tmp/case-env/shared/uploads" "$tmp/case-env/backups"
cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then
  printf 'ok\n'
  exit 0
fi
target=$(printf '%s\n' "$2" | sed -n "s/^\\.backup '\\(.*\\)'$/\\1/p")
[ -n "$target" ]
: > "$target"
STUB
chmod +x "$tmp/bin/flock" "$tmp/bin/sqlite3"
: > "$tmp/case-env/shared/data/sqlite.db"

if PATH="$tmp/bin:$PATH" \
  NODE_ENV=test \
  KOTOBA_TEST_ALLOW_NONSTANDARD_BASE=1 \
  APP_BASE="$tmp/case-env" \
  bash future/backup.sh; then
  printf 'backup without env unexpectedly succeeded\n' >&2
  exit 41
fi

mkdir -p "$tmp/case-uploads/config" "$tmp/case-uploads/shared/data" "$tmp/case-uploads/backups"
: > "$tmp/case-uploads/shared/data/sqlite.db"
printf 'secret=value\n' > "$tmp/case-uploads/config/kotoba.env"
if PATH="$tmp/bin:$PATH" \
  NODE_ENV=test \
  KOTOBA_TEST_ALLOW_NONSTANDARD_BASE=1 \
  APP_BASE="$tmp/case-uploads" \
  bash future/backup.sh; then
  printf 'backup without uploads unexpectedly succeeded\n' >&2
  exit 42
fi
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("uses an independent backup lock so cron cannot race a deploy snapshot", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads" "$tmp/backups"
cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then
  printf 'ok\n'
  exit 0
fi
target=$(printf '%s\n' "$2" | sed -n "s/^\\.backup '\\(.*\\)'$/\\1/p")
[ -n "$target" ]
: > "$target"
STUB
chmod +x "$tmp/bin/flock" "$tmp/bin/sqlite3"
: > "$tmp/shared/data/sqlite.db"
printf 'secret=value\n' > "$tmp/config/kotoba.env"

if PATH="$tmp/bin:$PATH" \
  NODE_ENV=test \
  KOTOBA_TEST_ALLOW_NONSTANDARD_BASE=1 \
  APP_BASE="$tmp" \
  bash future/backup.sh; then
  printf 'backup ignored the held lock\n' >&2
  exit 41
fi
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);
});
