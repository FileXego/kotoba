import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";

const deploy = await Bun.file("future/deploy.sh").text();
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

describe("release builder privilege isolation", () => {
  it("uses a dedicated non-login builder identity with an empty environment", () => {
    expect(deploy).toContain('BUILD_USER="kotoba-build"');
    expect(deploy).toContain('useradd --system --home /nonexistent --shell /usr/sbin/nologin "$BUILD_USER"');
    expect(deploy).toContain('sudo -u "$BUILD_USER" env -i');
    expect(deploy).toContain('PATH=/usr/local/bin:/usr/bin:/bin');
    expect(deploy).toContain('HOME="$build_home"');
    expect(deploy).toContain('XDG_CACHE_HOME="$build_home/cache"');
  });

  it("does not run dependency lifecycle or Vite build as the sudo-capable operator", () => {
    const prepareStart = deploy.indexOf("prepare_release() {");
    const prepareEnd = deploy.indexOf("\nrelease_revision() {", prepareStart);
    const prepare = deploy.slice(prepareStart, prepareEnd);
    const clone = prepare.indexOf('git clone "$REPO_URL" "$release_dir"');
    const sourceRootOwnership = prepare.indexOf('sudo chown -R root:root "$release_dir"');
    const writableBuildOutputs = prepare.indexOf('sudo install -d -o "$BUILD_USER" -g "$BUILD_USER"');
    const isolatedBuild = prepare.indexOf('sudo -u "$BUILD_USER" env -i');
    const processCleanup = prepare.indexOf("stop_build_user_processes", isolatedBuild);
    const sourceVerification = prepare.indexOf('git -C "$release_dir" diff --exit-code');
    const finalRootOwnership = prepare.lastIndexOf('sudo chown -R root:root "$release_dir"');

    expect(clone).toBeGreaterThanOrEqual(0);
    expect(sourceRootOwnership).toBeGreaterThan(clone);
    expect(writableBuildOutputs).toBeGreaterThan(sourceRootOwnership);
    expect(isolatedBuild).toBeGreaterThan(writableBuildOutputs);
    expect(processCleanup).toBeGreaterThan(isolatedBuild);
    expect(sourceVerification).toBeGreaterThan(processCleanup);
    expect(finalRootOwnership).toBeGreaterThan(sourceVerification);
    expect(prepare).not.toContain('sudo chown -R "$BUILD_USER:$BUILD_USER" "$release_dir"');
    expect(prepare).not.toMatch(/\n\s*bun install/);
    expect(prepare).not.toMatch(/\n\s*bun run --cwd client build/);
  });

  it("keeps reviewed source and root-installed runtime templates immutable to lifecycle scripts", () => {
    const prepareStart = deploy.indexOf("prepare_release() {");
    const prepareEnd = deploy.indexOf("\nrelease_revision() {", prepareStart);
    const prepare = deploy.slice(prepareStart, prepareEnd);

    expect(prepare).toContain('"$release_dir/node_modules"');
    expect(prepare).toContain('"$release_dir/client/node_modules"');
    expect(prepare).toContain('"$release_dir/client/dist"');
    expect(prepare).toContain('git -C "$release_dir" diff --exit-code');
    expect(prepare).toContain('git -C "$release_dir" status --porcelain');
    expect(prepare).toContain('find "$release_dir/client/dist" -mindepth 1');
    expect(prepare).toContain("non-regular or symbolic static build output");
    expect(prepare).not.toContain('chown -R "$BUILD_USER:$BUILD_USER" "$release_dir/future"');
  });

  it("rejects a builder identity with any supplementary group", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
BUILD_USER=kotoba-build
builder_groups="991 27"
getent() {
  if [ "$1" = "passwd" ]; then
    printf 'kotoba-build:x:991:991::/nonexistent:/usr/sbin/nologin\n'
  else
    printf 'kotoba-build:x:991:\n'
  fi
}
id() {
  case "$1" in
    -u) printf '991\n' ;;
    -g) printf '991\n' ;;
    -G) printf '%s\n' "$builder_groups" ;;
    *) return 1 ;;
  esac
}

if validate_build_user; then
  printf 'builder with supplementary sudo-like group was accepted\n' >&2
  exit 41
fi
builder_groups="991"
validate_build_user
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);

  it("terminates only the dedicated builder's residual processes and verifies they are gone", async () => {
    const result = await runBash(String.raw`
set -euo pipefail
${SOURCE_DEPLOY_FUNCTIONS}
BUILD_USER=kotoba-build
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
alive=1
sleep() { :; }
command() {
  if [ "$1" = "-v" ] && { [ "$2" = "pkill" ] || [ "$2" = "pgrep" ]; }; then
    printf '%s\n' "$2"
    return 0
  fi
  builtin command "$@"
}
sudo() {
  local command="$1"
  shift
  case "$command" in
    pkill)
      [ "$2" = "-u" ] && [ "$3" = "$BUILD_USER" ]
      printf '%s\n' "$1" >> "$tmp/signals"
      [ "$1" != "-KILL" ] || alive=0
      ;;
    pgrep)
      [ "$1" = "-u" ] && [ "$2" = "$BUILD_USER" ]
      [ "$alive" -eq 1 ]
      ;;
    *)
      return 42
      ;;
  esac
}

stop_build_user_processes
grep -Fx -- "-TERM" "$tmp/signals"
grep -Fx -- "-KILL" "$tmp/signals"
[ "$alive" -eq 0 ]

sudo() {
  case "$1" in
    pkill) return 0 ;;
    pgrep) return 0 ;;
    *) return 42 ;;
  esac
}
if stop_build_user_processes; then
  printf 'builder cleanup succeeded while processes still survived\n' >&2
  exit 43
fi

command() {
  if [ "$1" = "-v" ]; then
    return 1
  fi
  builtin command "$@"
}
sudo() { return 1; }
if stop_build_user_processes; then
  printf 'builder cleanup succeeded without process inspection tools\n' >&2
  exit 44
fi
`);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 15_000);
});
