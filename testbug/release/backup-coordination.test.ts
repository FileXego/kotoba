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
    env: {
      ...process.env,
      NODE_ENV: "test",
      KOTOBA_TEST_ALLOW_NONSTANDARD_BASE: "1",
    },
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

describe("backup and deployment coordination", () => {
  it("restricts root-operated backup paths to a dedicated child below /opt or /srv", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
eval "$(sed -n '/^validate_app_base()/,/^}/p' future/backup.sh)"
declare -F validate_app_base >/dev/null

validate_app_base /opt/kotoba 0
validate_app_base /srv/apps/kotoba 0
for unsafe in /opt /srv /etc/kotoba /opt/kotoba/../other; do
  if validate_app_base "$unsafe" 0; then
    printf 'unsafe root backup base was accepted: %s\n' "$unsafe" >&2
    exit 40
  fi
done
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    const backup = await Bun.file("future/backup.sh").text();
    const serviceActivity = backup.slice(
      backup.indexOf("service_activity() {"),
      backup.indexOf("mkdir -p"),
    );
    expect(serviceActivity).toContain(
      "systemctl is required for root-operated backups",
    );
    expect(backup).toContain('[ -L "$BACKUP_DIR" ]');
  }, 45_000);

  it("takes the shared deployment lock before the backup lock", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads"
cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$KOTOBA_TEST_LOG"
exit 0
STUB
chmod +x "$tmp/bin/flock"
export KOTOBA_TEST_LOG="$tmp/flock.log"
if PATH="$tmp/bin:$PATH" APP_BASE="$tmp" bash future/backup.sh; then
  printf 'backup without a database unexpectedly succeeded\n' >&2
  exit 40
fi
grep -Fx -- '-s -n 7' "$KOTOBA_TEST_LOG"
grep -Fx -- '-n 8' "$KOTOBA_TEST_LOG"
[ "$(sed -n '1p' "$KOTOBA_TEST_LOG")" = '-s -n 7' ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    const backup = await Bun.file("future/backup.sh").text();
    const sharedLock = backup.indexOf("flock -s -n 7");
    const prepareDirectory = backup.indexOf('mkdir -p "$BACKUP_DIR"');
    const backupLock = backup.indexOf("flock -n 8");
    expect(sharedLock).toBeLessThan(prepareDirectory);
    expect(prepareDirectory).toBeLessThan(backupLock);
  }, 45_000);

  it("quiesces an active service for the whole DB, env, and uploads snapshot", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads"
printf 'COOKIE_SECRET=0123456789abcdef0123456789abcdef\n' > "$tmp/config/kotoba.env"
printf 'db\n' > "$tmp/shared/data/sqlite.db"
printf 'image\n' > "$tmp/shared/uploads/avatar.png"
export KOTOBA_TEST_LOG="$tmp/order.log"

cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sudo" <<'STUB'
#!/usr/bin/env bash
"$@"
STUB
cat > "$tmp/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  is-active)
    if [ ! -e "$KOTOBA_TEST_STATE" ]; then
      exit 0
    fi
    exit 3
    ;;
  stop)
    : > "$KOTOBA_TEST_STATE"
    printf '%s\n' "$1" >> "$KOTOBA_TEST_LOG"
    ;;
  start)
    rm -f "$KOTOBA_TEST_STATE"
    printf '%s\n' "$1" >> "$KOTOBA_TEST_LOG"
    ;;
  *) exit 0 ;;
esac
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then
  printf 'ok\n'
  exit 0
fi
target=$(printf '%s\n' "$2" | sed -n "s/^\.backup '\(.*\)'$/\1/p")
[ -n "$target" ]
printf 'db snapshot\n' > "$target"
printf 'database-backup\n' >> "$KOTOBA_TEST_LOG"
STUB
cat > "$tmp/bin/tar" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
target=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-czf" ]; then target="$2"; shift 2; continue; fi
  shift
done
[ -n "$target" ]
printf 'uploads snapshot\n' > "$target"
printf 'uploads-backup\n' >> "$KOTOBA_TEST_LOG"
STUB
cat > "$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '{"success":true,"status":"ready","revision":"0123456789abcdef0123456789abcdef01234567"}'
STUB
chmod +x "$tmp/bin/"*
export KOTOBA_TEST_STATE="$tmp/service-inactive"
mkdir -p "$tmp/releases/current"
printf '0123456789abcdef0123456789abcdef01234567\n' > "$tmp/releases/current/.release-revision"
ln -s "$tmp/releases/current" "$tmp/current"

PATH="$tmp/bin:$PATH" APP_BASE="$tmp" KOTOBA_HEALTH_URL="http://127.0.0.1:3000/api/health" \
  bash future/backup.sh

[ ! -e "$tmp/maintenance" ]
stop_line=$(grep -n '^stop$' "$KOTOBA_TEST_LOG" | cut -d: -f1)
db_line=$(grep -n '^database-backup$' "$KOTOBA_TEST_LOG" | cut -d: -f1)
uploads_line=$(grep -n '^uploads-backup$' "$KOTOBA_TEST_LOG" | cut -d: -f1)
start_line=$(grep -n '^start$' "$KOTOBA_TEST_LOG" | cut -d: -f1)
[ "$stop_line" -lt "$db_line" ]
[ "$db_line" -lt "$uploads_line" ]
[ "$uploads_line" -lt "$start_line" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("aborts instead of treating an indeterminate service state as quiescent", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads"
printf 'COOKIE_SECRET=0123456789abcdef0123456789abcdef\n' > "$tmp/config/kotoba.env"
printf 'db\n' > "$tmp/shared/data/sqlite.db"
printf 'image\n' > "$tmp/shared/uploads/avatar.png"
export KOTOBA_TEST_LOG="$tmp/order.log"

cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sudo" <<'STUB'
#!/usr/bin/env bash
"$@"
STUB
cat > "$tmp/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
exit 4
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
printf 'sqlite-was-called\n' >> "$KOTOBA_TEST_LOG"
if [ "$2" = "PRAGMA integrity_check;" ]; then printf 'ok\n'; fi
exit 0
STUB
chmod +x "$tmp/bin/"*

set +e
PATH="$tmp/bin:$PATH" APP_BASE="$tmp" bash future/backup.sh
rc=$?
set -e
[ "$rc" -ne 0 ]
[ ! -e "$KOTOBA_TEST_LOG" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("preserves a maintenance flag that existed before the backup", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads" "$tmp/releases/current"
printf 'COOKIE_SECRET=0123456789abcdef0123456789abcdef\n' > "$tmp/config/kotoba.env"
printf 'db\n' > "$tmp/shared/data/sqlite.db"
printf 'image\n' > "$tmp/shared/uploads/avatar.png"
printf '0123456789abcdef0123456789abcdef01234567\n' > "$tmp/releases/current/.release-revision"
ln -s "$tmp/releases/current" "$tmp/current"
: > "$tmp/maintenance"
export KOTOBA_TEST_STATE="$tmp/service-inactive"

cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sudo" <<'STUB'
#!/usr/bin/env bash
"$@"
STUB
cat > "$tmp/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  is-active) [ ! -e "$KOTOBA_TEST_STATE" ] && exit 0 || exit 3 ;;
  stop) : > "$KOTOBA_TEST_STATE" ;;
  start) rm -f "$KOTOBA_TEST_STATE" ;;
esac
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then printf 'ok\n'; exit 0; fi
target=$(printf '%s\n' "$2" | sed -n "s/^\.backup '\(.*\)'$/\1/p")
printf 'db snapshot\n' > "$target"
STUB
cat > "$tmp/bin/tar" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-czf" ]; then printf 'uploads\n' > "$2"; exit 0; fi
  shift
done
exit 1
STUB
cat > "$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '{"success":true,"status":"ready","revision":"0123456789abcdef0123456789abcdef01234567"}'
STUB
chmod +x "$tmp/bin/"*

PATH="$tmp/bin:$PATH" APP_BASE="$tmp" bash future/backup.sh
[ -e "$tmp/maintenance" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("preserves the original failure status when recovery also fails", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads" "$tmp/releases/current"
printf 'COOKIE_SECRET=0123456789abcdef0123456789abcdef\n' > "$tmp/config/kotoba.env"
printf 'db\n' > "$tmp/shared/data/sqlite.db"
printf 'image\n' > "$tmp/shared/uploads/avatar.png"
printf '0123456789abcdef0123456789abcdef01234567\n' > "$tmp/releases/current/.release-revision"
ln -s "$tmp/releases/current" "$tmp/current"
export KOTOBA_TEST_STATE="$tmp/service-inactive"

cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sudo" <<'STUB'
#!/usr/bin/env bash
"$@"
STUB
cat > "$tmp/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  is-active) [ ! -e "$KOTOBA_TEST_STATE" ] && exit 0 || exit 3 ;;
  stop) : > "$KOTOBA_TEST_STATE" ;;
  start) exit 9 ;;
esac
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then printf 'ok\n'; exit 0; fi
target=$(printf '%s\n' "$2" | sed -n "s/^\.backup '\(.*\)'$/\1/p")
printf 'db snapshot\n' > "$target"
STUB
cat > "$tmp/bin/tar" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-czf" ]; then printf 'uploads\n' > "$2"; exit 0; fi
  shift
done
exit 1
STUB
cat > "$tmp/bin/find" <<'STUB'
#!/usr/bin/env bash
exit 42
STUB
chmod +x "$tmp/bin/"*

set +e
PATH="$tmp/bin:$PATH" APP_BASE="$tmp" bash future/backup.sh
rc=$?
set -e
[ "$rc" -eq 42 ]
[ -e "$tmp/maintenance" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("uses a unique complete-set id and deletes expired manifests before payloads", async () => {
    const backup = await Bun.file("future/backup.sh").text();
    expect(backup).toContain("mktemp -d");
    expect(backup).toContain('.pending-${DATE}-XXXXXX');
    expect(backup).toContain("BACKUP_ID=");
    const retention = backup.slice(backup.indexOf("find "));
    expect(retention.indexOf("manifest_*.sha256")).toBeLessThan(
      retention.indexOf("sqlite_*.db"),
    );
  });

  it("parses readiness JSON exactly instead of accepting matching text in another field", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
eval "$(sed -n '/^health_response_is_ready()/,/^}/p' future/backup.sh)"
declare -F health_response_is_ready >/dev/null
EXPECTED_REVISION=0123456789abcdef0123456789abcdef01234567

spoof='{"success":false,"status":"blocked","revision":"wrong","note":"\"success\":true \"status\":\"ready\" \"revision\":\"0123456789abcdef0123456789abcdef01234567\""}'
if health_response_is_ready "$spoof"; then
  printf 'spoofed readiness payload was accepted\n' >&2
  exit 40
fi
health_response_is_ready '{"success":true,"status":"ready","revision":"0123456789abcdef0123456789abcdef01234567"}'
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("never overwrites an existing complete-set payload even if an id is reused", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads" "$tmp/backups"
printf 'COOKIE_SECRET=0123456789abcdef0123456789abcdef\n' > "$tmp/config/kotoba.env"
printf 'db\n' > "$tmp/shared/data/sqlite.db"
printf 'image\n' > "$tmp/shared/uploads/avatar.png"
printf 'old-backup-must-survive\n' > "$tmp/backups/sqlite_20000101_000000-ABC123.db"

cat > "$tmp/bin/date" <<'STUB'
#!/usr/bin/env bash
printf '20000101_000000\n'
STUB
cat > "$tmp/bin/mktemp" <<'STUB'
#!/usr/bin/env bash
target="$APP_BASE/backups/.pending-20000101_000000-ABC123"
mkdir -m 0700 "$target"
printf '%s\n' "$target"
STUB
cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
exit 3
STUB
cat > "$tmp/bin/sudo" <<'STUB'
#!/usr/bin/env bash
"$@"
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then printf 'ok\n'; exit 0; fi
target=$(printf '%s\n' "$2" | sed -n "s/^\.backup '\(.*\)'$/\1/p")
printf 'new backup\n' > "$target"
STUB
cat > "$tmp/bin/tar" <<'STUB'
#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-czf" ]; then printf 'uploads\n' > "$2"; exit 0; fi
  shift
done
exit 1
STUB
chmod +x "$tmp/bin/"*

set +e
PATH="$tmp/bin:$PATH" APP_BASE="$tmp" bash future/backup.sh
rc=$?
set -e
[ "$rc" -ne 0 ]
grep -Fx 'old-backup-must-survive' "$tmp/backups/sqlite_20000101_000000-ABC123.db"
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("rejects a maintenance symlink without touching its target", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/config" "$tmp/shared/data" "$tmp/shared/uploads" "$tmp/releases/current"
printf 'COOKIE_SECRET=0123456789abcdef0123456789abcdef\n' > "$tmp/config/kotoba.env"
printf 'db\n' > "$tmp/shared/data/sqlite.db"
printf 'image\n' > "$tmp/shared/uploads/avatar.png"
printf '0123456789abcdef0123456789abcdef01234567\n' > "$tmp/releases/current/.release-revision"
ln -s "$tmp/releases/current" "$tmp/current"
printf 'sentinel\n' > "$tmp/sentinel"
ln -s "$tmp/sentinel" "$tmp/maintenance"
export KOTOBA_TEST_STATE="$tmp/service-inactive"

cat > "$tmp/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$tmp/bin/sudo" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = "test" ] && [ "$2" = "-L" ] && [ "$3" = "$APP_BASE/maintenance" ]; then
  exit 0
fi
"$@"
STUB
cat > "$tmp/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  is-active) [ ! -e "$KOTOBA_TEST_STATE" ] && exit 0 || exit 3 ;;
  stop) : > "$KOTOBA_TEST_STATE" ;;
  start) rm -f "$KOTOBA_TEST_STATE" ;;
esac
STUB
cat > "$tmp/bin/sqlite3" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [ "$2" = "PRAGMA integrity_check;" ]; then printf 'ok\n'; exit 0; fi
target=$(printf '%s\n' "$2" | sed -n "s/^\.backup '\(.*\)'$/\1/p")
printf 'db snapshot\n' > "$target"
STUB
cat > "$tmp/bin/tar" <<'STUB'
#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-czf" ]; then printf 'uploads\n' > "$2"; exit 0; fi
  shift
done
exit 1
STUB
cat > "$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '{"success":true,"status":"ready","revision":"0123456789abcdef0123456789abcdef01234567"}'
STUB
chmod +x "$tmp/bin/"*

set +e
PATH="$tmp/bin:$PATH" APP_BASE="$tmp" bash future/backup.sh
rc=$?
set -e
[ "$rc" -ne 0 ]
grep -Fx sentinel "$tmp/sentinel"
[ -e "$tmp/maintenance" ]
[ ! -e "$KOTOBA_TEST_STATE" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);
});
