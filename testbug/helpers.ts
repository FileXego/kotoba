import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ===== env setup: MUST be set BEFORE any app imports =====
export const TEST_ROOT = mkdtempSync(join(tmpdir(), `kotoba-test-${process.pid}-`));
export const TEST_DB = join(TEST_ROOT, "sqlite.db");
export const TEST_UPLOAD_DIR = join(TEST_ROOT, "uploads");
process.env.TEST_DB = TEST_DB;
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
process.env.UPLOAD_MAX_BYTES = String(32 * 1024 * 1024);
process.env.COOKIE_SECRET = "test-secret";
process.env.TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
process.env.SKIP_CAPTCHA = "1";
process.env.SKIP_RATE_LIMIT = "1";
// =========================================================

export function runMigrations(path = TEST_DB) {
  const sqlite = new Database(path);
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA busy_timeout = 5000");
  migrate(drizzle(sqlite), { migrationsFolder: resolve("drizzle/migrations") });
  sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  sqlite.close();
}

// Create the shared test DB through the same migration chain used in production.
runMigrations();

let _app: Awaited<ReturnType<typeof import("../src/app").createApp>> | null = null;

/** Build the Elysia app once and return it. Call clearTables() before each suite. */
export async function setupApp() {
  if (!_app) {
    const { createApp } = await import("../src/app");
    _app = await createApp({ staticMode: false });
  }
  clearTables();
  return { app: _app, cleanup: clearTables };
}

/** Wipe all data between test suites, preserving schema. */
function clearTables() {
  const s = new Database(TEST_DB);
  const tables = s
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
    )
    .all();
  s.exec("PRAGMA foreign_keys = OFF");
  const clear = s.transaction(() => {
    for (const { name } of tables) {
      const quoted = name.replaceAll('"', '""');
      s.exec(`DELETE FROM "${quoted}"`);
    }
  });
  clear();
  s.exec("PRAGMA foreign_keys = ON");
  const violations = s.query("PRAGMA foreign_key_check").all();
  s.close();
  if (violations.length > 0) {
    throw new Error("Test database cleanup left foreign-key violations");
  }
}

/** Remove the temporary test DB file. Call once at process exit. */
export function cleanup() {
  removeTestDbFiles();
}

// Delete the test DB file when the process exits
process.on("exit", removeTestDbFiles);

function removeTestDbFiles() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(resolve(`${TEST_DB}${suffix}`));
    } catch {
      // already cleaned up
    }
  }
  const resolvedRoot = resolve(TEST_ROOT);
  const resolvedTemp = resolve(tmpdir());
  const relativeRoot = resolvedRoot.slice(resolvedTemp.length);
  if (
    resolvedRoot !== resolvedTemp &&
    (relativeRoot.startsWith("\\kotoba-test-") || relativeRoot.startsWith("/kotoba-test-"))
  ) {
    try {
      rmSync(resolvedRoot, { recursive: true, force: true });
    } catch {
      // The OS temp directory can be reclaimed if a worker still owns a file.
    }
  }
}

/** Extract the session cookie value from a Set-Cookie header. */
export function extractCookie(res: Response): string | null {
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}
