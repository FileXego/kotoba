import { Database } from "bun:sqlite";
import { afterAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const temporaryDirectories: string[] = [];

function migrationFolderThrough0006() {
  const directory = mkdtempSync(join(tmpdir(), "kotoba-migrations-"));
  temporaryDirectories.push(directory);
  const metaDirectory = join(directory, "meta");
  mkdirSync(metaDirectory);

  const journalPath = resolve("drizzle/migrations/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= 6);
  writeFileSync(join(metaDirectory, "_journal.json"), JSON.stringify(journal, null, 2));

  for (const entry of journal.entries) {
    copyFileSync(
      resolve(`drizzle/migrations/${entry.tag}.sql`),
      join(directory, `${entry.tag}.sql`),
    );
  }
  return directory;
}

function runMigrations(databasePath: string, migrationsFolder: string) {
  const sqlite = new Database(databasePath);
  sqlite.exec("PRAGMA foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder });
  sqlite.close();
}

describe("message ownership backfill migration", () => {
  afterAll(() => {
    for (const directory of temporaryDirectories) {
      try {
        rmSync(directory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      } catch {
        // Windows can briefly retain SQLite WAL handles after a test process closes.
      }
    }
  });

  it("binds only messages whose author account existed when the message was created", () => {
    const directory = mkdtempSync(join(tmpdir(), "kotoba-backfill-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "upgrade.db");
    // Drizzle's `timestamp` mode stores whole seconds, so equal values are
    // ambiguous and must not let an account registered later claim a message.
    const messageCreatedAt = 1_700_000_000;

    runMigrations(databasePath, migrationFolderThrough0006());
    const before = new Database(databasePath);
    before.query(`
      INSERT INTO users (username, email, password_hash, is_admin, created_at, theme)
      VALUES (?, ?, ?, 0, ?, 'light')
    `).run(
      "existing-author",
      "existing@example.test",
      "hash",
      messageCreatedAt - 1_000,
    );
    const author = before.query<{ id: number }, []>(
      "SELECT id FROM users WHERE username = 'existing-author'",
    ).get();
    if (!author) throw new Error("Failed to create migration fixture user");

    before.query(`
      INSERT INTO messages (name, content, created_at, deleted, depth, user_id)
      VALUES (?, ?, ?, 0, 0, NULL)
    `).run("existing-author", "owned before migration", messageCreatedAt);
    before.query(`
      INSERT INTO messages (name, content, created_at, deleted, depth, user_id)
      VALUES (?, ?, ?, 0, 0, NULL)
    `).run("late-author", "must not be claimed by a later account", messageCreatedAt);
    before.query(`
      INSERT INTO messages (name, content, created_at, deleted, depth, user_id)
      VALUES (?, ?, ?, 0, 0, NULL)
    `).run("same-second-author", "ambiguous ordering must remain unbound", messageCreatedAt);
    before.query(`
      INSERT INTO messages (name, content, created_at, deleted, depth, user_id)
      VALUES (?, ?, ?, 0, 0, NULL)
    `).run("future-author", "must remain unbound", messageCreatedAt);
    before.query(`
      INSERT INTO users (username, email, password_hash, is_admin, created_at, theme)
      VALUES (?, ?, ?, 0, ?, 'light')
    `).run(
      "late-author",
      "late@example.test",
      "hash",
      messageCreatedAt + 1_000,
    );
    before.query(`
      INSERT INTO users (username, email, password_hash, is_admin, created_at, theme)
      VALUES (?, ?, ?, 0, ?, 'light')
    `).run(
      "same-second-author",
      "same-second@example.test",
      "hash",
      messageCreatedAt,
    );
    before.close();

    runMigrations(databasePath, resolve("drizzle/migrations"));
    const upgraded = new Database(databasePath, { readonly: true });
    const rows = upgraded.query<{ name: string; userId: number | null }, []>(
      "SELECT name, user_id AS userId FROM messages ORDER BY id",
    ).all();
    upgraded.close();

    expect(rows).toEqual([
      { name: "existing-author", userId: author.id },
      { name: "late-author", userId: null },
      { name: "same-second-author", userId: null },
      { name: "future-author", userId: null },
    ]);
  });
});
