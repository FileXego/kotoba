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
});
