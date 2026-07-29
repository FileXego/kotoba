import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
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
const readinessRoot = mkdtempSync(join(tmpdir(), "kotoba-readiness-"));
temporaryDirectories.push(readinessRoot);
const originalUploadDir = process.env.UPLOAD_DIR;
process.env.UPLOAD_DIR = join(readinessRoot, "uploads");

const { assertApplicationReady } = await import("../../src/lib/readiness");

function migrationFolderThrough(maxIndex: number) {
  const directory = mkdtempSync(join(tmpdir(), "kotoba-readiness-migrations-"));
  temporaryDirectories.push(directory);
  const metaDirectory = join(directory, "meta");
  mkdirSync(metaDirectory);

  const journalPath = resolve("drizzle/migrations/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= maxIndex);
  writeFileSync(join(metaDirectory, "_journal.json"), JSON.stringify(journal, null, 2));

  for (const entry of journal.entries) {
    copyFileSync(
      resolve(`drizzle/migrations/${entry.tag}.sql`),
      join(directory, `${entry.tag}.sql`),
    );
  }
  return directory;
}

function migratedDatabase(migrationsFolder = resolve("drizzle/migrations")) {
  const directory = mkdtempSync(join(tmpdir(), "kotoba-readiness-db-"));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, "readiness.db");
  const sqlite = new Database(databasePath);
  sqlite.exec("PRAGMA foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder });
  sqlite.close();
  return databasePath;
}

async function expectDatabaseNotReady(databasePath: string) {
  process.env.TEST_DB = databasePath;
  await expect(assertApplicationReady(false)).rejects.toThrow();
}

describe("database readiness", () => {
  const originalTestDb = process.env.TEST_DB;

  beforeAll(() => {
    delete process.env.TEST_DB;
  });

  afterAll(() => {
    if (originalTestDb === undefined) {
      delete process.env.TEST_DB;
    } else {
      process.env.TEST_DB = originalTestDb;
    }
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalUploadDir;
    }
    for (const directory of temporaryDirectories) {
      try {
        rmSync(directory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      } catch {
        // Windows can briefly retain SQLite handles after a test process closes.
      }
    }
  });

  it("rejects a database missing a required pure-data migration", async () => {
    const databasePath = migratedDatabase(migrationFolderThrough(6));

    await expectDatabaseNotReady(databasePath);
  });

  it("rejects a database missing a runtime-required column", async () => {
    const databasePath = migratedDatabase();
    const sqlite = new Database(databasePath);
    sqlite.exec("ALTER TABLE users DROP COLUMN signature");
    sqlite.close();

    await expectDatabaseNotReady(databasePath);
  });

  it("accepts a database that also contains a future migration", async () => {
    const databasePath = migratedDatabase();
    const sqlite = new Database(databasePath);
    sqlite.query(`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (?, ?)
    `).run("future-release-migration-hash", 9_999_999_999_999);
    sqlite.close();
    process.env.TEST_DB = databasePath;

    await expect(assertApplicationReady(false)).resolves.toBeUndefined();
  });
});
