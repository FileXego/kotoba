import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";

const BASH = process.platform === "win32"
  ? "C:\\Program Files\\Git\\bin\\bash.exe"
  : "bash";
const bootstrapPath = "future/bootstrap-v2.1.1-to-v2.1.2.sh";

async function runBash(script: string) {
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

describe("v2.1.1 production topology bootstrap", () => {
  it("is a valid, versioned Bash entrypoint", async () => {
    const child = Bun.spawn({
      cmd: [BASH, "-n", bootstrapPath],
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited, stderr).toBe(0);
    expect(existsSync(bootstrapPath)).toBe(true);
  });

  it("copies a stopped legacy snapshot into the new topology without destroying the rollback source", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    expect(bootstrap).toContain('LEGACY_ENV="$SHARED_DIR/.env"');
    expect(bootstrap).toContain('LEGACY_DB="$SHARED_DIR/sqlite.db"');
    expect(bootstrap).toContain('sqlite3 "$LEGACY_DB" ".backup');
    expect(bootstrap).toContain('install -m 0640 "$LEGACY_DB_BACKUP" "$DB_PATH"');
    expect(bootstrap).not.toContain('mv -- "$LEGACY_DB" "$DB_PATH"');
    expect(bootstrap).not.toContain('mv -- "$LEGACY_ENV" "$ENV_FILE"');
  });

  it("keeps maintenance through stop, snapshot, migration, activation, and verified recovery", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    const main = bootstrap.slice(bootstrap.indexOf("main() {"));
    const orderedMarkers = [
      "enter_bootstrap_maintenance",
      "stop_and_prove_service_inactive",
      "snapshot_legacy_installation",
      "seed_new_topology",
      "prepare_release",
      "run_migrations",
      "activate_release",
      "retire_legacy_release",
      "leave_maintenance",
    ];
    let cursor = -1;
    for (const marker of orderedMarkers) {
      const next = main.indexOf(marker, cursor + 1);
      expect(next, `missing or out-of-order marker: ${marker}`).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(bootstrap).toContain("recover_legacy_installation");
    expect(bootstrap).toContain("wait_for_legacy_health");
    expect(bootstrap).toContain("restore_legacy_crontabs");
    expect(bootstrap).toContain("install_bootstrap_backup_schedule");
  });

  it("commits the successful bootstrap state before opening public traffic", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    const main = bootstrap.slice(bootstrap.indexOf("main() {"));
    const complete = main.indexOf("BOOTSTRAP_COMPLETE=1");
    const leaveMaintenance = main.indexOf("\n  leave_maintenance ||");

    expect(complete).toBeGreaterThanOrEqual(0);
    expect(leaveMaintenance).toBeGreaterThan(complete);
    expect(main.slice(leaveMaintenance)).not.toContain("BOOTSTRAP_COMPLETE=1");
    expect(main.slice(leaveMaintenance)).not.toContain('FAILED_RELEASE=""');
  });

  it("creates the rescue manifest from inside the root-only directory with privilege", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    const snapshot = bootstrap.slice(
      bootstrap.indexOf("snapshot_legacy_installation() {"),
      bootstrap.indexOf("seed_new_topology() {"),
    );
    expect(snapshot).toContain("sudo sh -c");
    expect(snapshot).not.toMatch(/\(\s*\n\s*cd "\$LEGACY_RESCUE"/);
  });

  it("creates its maintenance marker without following a pre-existing symlink", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    const maintenance = bootstrap.slice(
      bootstrap.indexOf("enter_bootstrap_maintenance() {"),
      bootstrap.indexOf("recover_legacy_installation() {"),
    );
    const main = bootstrap.slice(bootstrap.indexOf("main() {"));
    expect(bootstrap).toContain("enter_bootstrap_maintenance");
    expect(bootstrap).toContain('sudo test -L "$APP_BASE/maintenance"');
    expect(bootstrap).toContain("set -C");
    expect(maintenance.indexOf("set -C")).toBeLessThan(
      maintenance.indexOf("MAINTENANCE_CREATED=1"),
    );
    expect(main).not.toContain(
      "MAINTENANCE_CREATED=1\n  enter_bootstrap_maintenance",
    );
  });

  it("does not ignore failures while disabling or restoring legacy backup crons", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export TMPDIR="$tmp"
source <(sed \
  -e 's|^SCRIPT_DIR=.*|SCRIPT_DIR="$(pwd)/future"|' \
  -e '/^trap bootstrap_exit EXIT/,$d' \
  future/bootstrap-v2.1.1-to-v2.1.2.sh)
CURRENT_LINK="$tmp/current"

crontab() {
  if [ "$1" = "-l" ]; then
    printf '0 3 * * * %s/future/backup.sh\n' "$CURRENT_LINK"
    return 0
  fi
  return 55
}
sudo() {
  if [ "$1" = "crontab" ]; then
    shift
    crontab "$@"
    return
  fi
  "$@"
}
pgrep() { return 1; }

if capture_and_disable_legacy_crontabs; then
  printf 'cron installation failure was ignored\n' >&2
  exit 40
fi
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    const bootstrap = await Bun.file(bootstrapPath).text();
    const capture = bootstrap.slice(
      bootstrap.indexOf("capture_and_disable_legacy_crontabs() {"),
      bootstrap.indexOf("read_crontab_snapshot() {"),
    );
    expect(capture).toContain("command -v pgrep");
    expect(capture).toContain('case "$pgrep_rc"');
  }, 45_000);

  it("does not replace a crontab when reading its current contents fails unexpectedly", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export TMPDIR="$tmp"
source <(sed \
  -e 's|^SCRIPT_DIR=.*|SCRIPT_DIR="$(pwd)/future"|' \
  -e '/^trap bootstrap_exit EXIT/,$d' \
  future/bootstrap-v2.1.1-to-v2.1.2.sh)
CURRENT_LINK="$tmp/current"
export KOTOBA_TEST_LOG="$tmp/cron-mutated"

crontab() {
  if [ "$1" = "-l" ]; then
    printf 'permission denied\n' >&2
    return 55
  fi
  : > "$KOTOBA_TEST_LOG"
  return 0
}
sudo() {
  if [ "$1" = "crontab" ]; then
    shift
    crontab "$@"
    return
  fi
  "$@"
}
pgrep() { return 1; }

if capture_and_disable_legacy_crontabs; then
  printf 'unexpected crontab read failure was treated as an empty crontab\n' >&2
  exit 40
fi
[ ! -e "$KOTOBA_TEST_LOG" ]
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("installs the new root backup schedule only from a successfully read crontab", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    expect(bootstrap).toContain("install_bootstrap_backup_schedule() {");
    const installer = bootstrap.slice(
      bootstrap.indexOf("install_bootstrap_backup_schedule() {"),
      bootstrap.indexOf("restore_legacy_crontabs() {"),
    );
    expect(installer).toContain("read_crontab_snapshot root");
    expect(installer).not.toContain("|| true");
  });

  it("parses the legacy health response exactly before recovery opens traffic", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
eval "$(sed -n '/^legacy_health_response_is_ready()/,/^}/p' future/bootstrap-v2.1.1-to-v2.1.2.sh)"
declare -F legacy_health_response_is_ready >/dev/null

spoof='{"success":false,"version":"9.9.9","note":"\"success\":true \"version\":\"2.1.0\""}'
if legacy_health_response_is_ready "$spoof"; then
  printf 'spoofed legacy health payload was accepted\n' >&2
  exit 40
fi
legacy_health_response_is_ready '{"success":true,"version":"2.1.0"}'
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 45_000);

  it("proves the candidate is stopped and the v2.1.1 process is healthy before recovery opens traffic", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    const recovery = bootstrap.slice(
      bootstrap.indexOf("recover_legacy_installation() {"),
      bootstrap.indexOf("retire_legacy_release() {"),
    );
    expect(recovery).toContain("stop_and_prove_service_inactive");
    expect(bootstrap).toContain('payload.get("version") == "2.1.0"');
    expect(recovery.indexOf("wait_for_legacy_health")).toBeLessThan(
      recovery.indexOf("leave_maintenance"),
    );
  });

  it("keeps a moved legacy release recoverable and removes only bootstrap-created topology files after rollback", async () => {
    const bootstrap = await Bun.file(bootstrapPath).text();
    const retire = bootstrap.slice(
      bootstrap.indexOf("retire_legacy_release() {"),
      bootstrap.indexOf("bootstrap_exit() {"),
    );
    expect(retire).toContain('LEGACY_RELEASE="$rescue_release"');
    expect(bootstrap).toContain("cleanup_failed_new_topology");
    expect(bootstrap).toContain('rm -f -- "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm"');
    expect(bootstrap).toContain('rm -f -- "$ENV_FILE"');
  });
});
