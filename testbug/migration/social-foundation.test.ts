import { Database } from "bun:sqlite";
import { afterAll, describe, expect, it } from "bun:test";
import { copyFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, runMigrations, setupApp } from "../helpers";

const temporaryFiles: string[] = [];

function tempDatabase(label: string) {
  const path = resolve(`testbug/.test-${label}-${process.pid}-${Date.now()}.db`);
  temporaryFiles.push(path, `${path}-wal`, `${path}-shm`);
  return path;
}

function rowCount(sqlite: Database, table: string) {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Unsafe test table name");
  return sqlite.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0;
}

async function runAudit(path: string) {
  const process = Bun.spawn(["bun", "run", "scripts/audit-social-db.ts"], {
    cwd: resolve("."),
    env: { ...Bun.env, DB_PATH: path },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

describe("production migration foundation", () => {
  afterAll(() => {
    cleanup();
    for (const path of temporaryFiles) {
      try { unlinkSync(path); } catch { /* already absent */ }
    }
  });

  it("builds the integration database through the production migration chain", async () => {
    await setupApp();
    const path = process.env.TEST_DB;
    if (!path) throw new Error("TEST_DB was not configured by test helpers");

    const sqlite = new Database(path);
    const migrationTable = sqlite
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
      )
      .get();
    sqlite.close();

    expect(migrationTable).toEqual({ name: "__drizzle_migrations" });
  });

  it("clears newly migrated application tables without a handwritten schema list", async () => {
    await setupApp();
    const path = process.env.TEST_DB;
    if (!path) throw new Error("TEST_DB was not configured by test helpers");

    const sqlite = new Database(path);
    sqlite.exec("CREATE TABLE IF NOT EXISTS future_rows (id INTEGER PRIMARY KEY)");
    sqlite.exec("INSERT INTO future_rows (id) VALUES (1)");
    sqlite.close();

    await setupApp();
    const reopened = new Database(path);
    const row = reopened
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM future_rows")
      .get();
    reopened.close();

    expect(row?.count).toBe(0);
  });

  it("upgrades the fixed 0006 production baseline without losing legacy data", () => {
    const path = tempDatabase("upgrade");
    const sqlite = new Database(path);
    sqlite.exec(readFileSync(resolve("testbug/fixtures/pre-social-0006.sql"), "utf8"));
    const before = {
      users: rowCount(sqlite, "users"),
      messages: rowCount(sqlite, "messages"),
      likes: rowCount(sqlite, "likes"),
      bookmarks: rowCount(sqlite, "bookmarks"),
    };
    sqlite.close();

    runMigrations(path);
    const upgraded = new Database(path);
    expect(upgraded.query<{ integrity_check: string }, []>("PRAGMA integrity_check").get())
      .toEqual({ integrity_check: "ok" });
    expect(upgraded.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect({
      users: rowCount(upgraded, "users"),
      messages: rowCount(upgraded, "messages"),
      likes: rowCount(upgraded, "likes"),
      bookmarks: rowCount(upgraded, "bookmarks"),
    }).toEqual(before);
    expect(upgraded.query("SELECT name, user_id FROM messages WHERE id = 1").get())
      .toEqual({ name: "legacy-writer", user_id: null });
    expect(upgraded.query("SELECT avatar_url, signature, theme FROM users WHERE id = 1").get())
      .toEqual({ avatar_url: "/uploads/alice.png", signature: "first signature", theme: "sumi" });
    expect(rowCount(upgraded, "profiles")).toBe(before.users);
    expect(upgraded.query(
      "SELECT user_id, display_name, avatar_url, signature, edition FROM profiles ORDER BY user_id",
    ).all()).toEqual([
      {
        user_id: 1,
        display_name: "alice",
        avatar_url: "/uploads/alice.png",
        signature: "first signature",
        edition: "sumi",
      },
      {
        user_id: 2,
        display_name: "bob",
        avatar_url: null,
        signature: null,
        edition: "light",
      },
    ]);
    expect(upgraded.query("SELECT id, name, user_id FROM messages ORDER BY id").all()).toEqual([
      { id: 1, name: "legacy-writer", user_id: null },
      { id: 2, name: "alice", user_id: 1 },
      { id: 3, name: "bob", user_id: 2 },
      { id: 4, name: "alice", user_id: 1 },
    ]);
    expect(upgraded.query(
      `SELECT id, visibility, moderation_state, content_version, reply_policy,
              client_request_id, audience_anchor_user_id
       FROM messages ORDER BY id`,
    ).all()).toEqual([
      { id: 1, visibility: "public", moderation_state: "published", content_version: 1, reply_policy: "viewer", client_request_id: null, audience_anchor_user_id: null },
      { id: 2, visibility: "public", moderation_state: "published", content_version: 1, reply_policy: "viewer", client_request_id: null, audience_anchor_user_id: 1 },
      { id: 3, visibility: "public", moderation_state: "published", content_version: 1, reply_policy: "viewer", client_request_id: null, audience_anchor_user_id: 1 },
      { id: 4, visibility: "public", moderation_state: "published", content_version: 1, reply_policy: "viewer", client_request_id: null, audience_anchor_user_id: 1 },
    ]);
    upgraded.close();
  });

  it("keeps migration reruns idempotent and a closed backup readable", () => {
    const path = tempDatabase("idempotent");
    const backupPath = tempDatabase("backup");
    const sqlite = new Database(path);
    sqlite.exec(readFileSync(resolve("testbug/fixtures/pre-social-0006.sql"), "utf8"));
    sqlite.close();

    runMigrations(path);
    runMigrations(path);
    const migrated = new Database(path);
    const expectedMessages = rowCount(migrated, "messages");
    const expectedMigrations = rowCount(migrated, "__drizzle_migrations");
    migrated.close();

    copyFileSync(path, backupPath);
    const restored = new Database(backupPath, { readonly: true });
    expect(rowCount(restored, "messages")).toBe(expectedMessages);
    expect(rowCount(restored, "__drizzle_migrations")).toBe(expectedMigrations);
    restored.close();
  });

  it("enforces relationship and idempotent-write constraints in SQLite", () => {
    const path = tempDatabase("constraints");
    runMigrations(path);
    const sqlite = new Database(path);
    sqlite.exec(`
      INSERT INTO users (id, username, email, password_hash, is_admin, created_at)
      VALUES
        (1, 'one', 'one@example.test', 'hash-one', 0, 1),
        (2, 'two', 'two@example.test', 'hash-two', 0, 2)
    `);

    expect(() => sqlite.exec(`
      INSERT INTO follows (follower_id, followed_id, active, created_at, updated_at)
      VALUES (1, 1, 1, 1, 1)
    `)).toThrow();

    sqlite.exec(`
      INSERT INTO follows (follower_id, followed_id, active, created_at, updated_at)
      VALUES (1, 2, 1, 1, 1)
    `);
    expect(() => sqlite.exec(`
      INSERT INTO follows (follower_id, followed_id, active, created_at, updated_at)
      VALUES (1, 2, 1, 2, 2)
    `)).toThrow();

    sqlite.exec(`
      INSERT INTO messages (name, content, created_at, user_id, client_request_id)
      VALUES ('one', 'first', 1, 1, 'request-1')
    `);
    expect(() => sqlite.exec(`
      INSERT INTO messages (name, content, created_at, user_id, client_request_id)
      VALUES ('one', 'duplicate', 2, 1, 'request-1')
    `)).toThrow();
    sqlite.close();
  });

  it("audits only aggregate migration and ownership facts", async () => {
    const path = tempDatabase("audit");
    const sqlite = new Database(path);
    sqlite.exec(readFileSync(resolve("testbug/fixtures/pre-social-0006.sql"), "utf8"));
    sqlite.close();
    runMigrations(path);

    const result = await runAudit(path);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      integrity: "ok",
      foreignKeyViolations: 0,
      users: 2,
      messages: 4,
      likes: 1,
      bookmarks: 1,
      profiles: 2,
      anonymousMessages: 1,
      orphanOwnership: 0,
      orphanInteractions: 0,
      invalidThreadLinks: 0,
      migrationVersion: 8,
    });
    expect(result.stdout).not.toContain("alice");
    expect(result.stdout).not.toContain("example.test");
    expect(result.stdout).not.toContain("anonymous legacy root");
  });

  it("fails the audit when foreign-key violations exist", async () => {
    const path = tempDatabase("audit-invalid");
    runMigrations(path);
    const sqlite = new Database(path);
    sqlite.exec("PRAGMA foreign_keys = OFF");
    sqlite.exec("INSERT INTO likes (user_id, message_id, created_at) VALUES (999, 999, 1)");
    sqlite.close();

    const result = await runAudit(path);
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      integrity: "ok",
      foreignKeyViolations: 2,
      orphanInteractions: 1,
    });
  });
});
