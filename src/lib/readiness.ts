import { Database } from "bun:sqlite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { clientIndexPath, ensureUploadDir, uploadDir } from "./files";

const REQUIRED_DATABASE_COLUMNS = {
  users: [
    "id",
    "username",
    "email",
    "password_hash",
    "is_admin",
    "created_at",
    "avatar_url",
    "signature",
    "theme",
  ],
  messages: [
    "id",
    "name",
    "content",
    "created_at",
    "updated_at",
    "deleted",
    "parent_id",
    "root_id",
    "depth",
    "user_id",
  ],
  likes: ["user_id", "message_id", "created_at"],
  bookmarks: ["user_id", "message_id", "created_at"],
} as const;

function assertRequiredMigrationsApplied(sqlite: Database) {
  const appliedHashes = new Set(
    sqlite
      .query<{ hash: string }, []>("SELECT hash FROM __drizzle_migrations")
      .all()
      .map(({ hash }) => hash),
  );
  const requiredMigrations = readMigrationFiles({
    migrationsFolder: resolve("drizzle/migrations"),
  });
  for (const { hash } of requiredMigrations) {
    if (!appliedHashes.has(hash)) {
      throw new Error("Database is missing a required migration");
    }
  }
}

function assertRequiredColumnsExist(sqlite: Database) {
  for (const [table, requiredColumns] of Object.entries(REQUIRED_DATABASE_COLUMNS)) {
    const actualColumns = new Set(
      sqlite
        .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
        .all()
        .map(({ name }) => name),
    );
    for (const column of requiredColumns) {
      if (!actualColumns.has(column)) {
        throw new Error(`Database is missing required column ${table}.${column}`);
      }
    }
  }
}

function assertDatabaseReady() {
  const path = process.env.TEST_DB || process.env.DB_PATH || "sqlite.db";
  const sqlite = new Database(path);
  try {
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec("PRAGMA busy_timeout = 2000");
    assertRequiredMigrationsApplied(sqlite);
    assertRequiredColumnsExist(sqlite);
    sqlite.query(`
      SELECT
        (SELECT count(*) FROM users) AS user_count,
        (SELECT count(*) FROM messages) AS message_count,
        (SELECT count(*) FROM likes) AS like_count,
        (SELECT count(*) FROM bookmarks) AS bookmark_count
    `).get();
    sqlite.exec("BEGIN IMMEDIATE; ROLLBACK;");
  } finally {
    sqlite.close();
  }
}

async function assertUploadStorageReady() {
  ensureUploadDir();
  const probe = `${uploadDir}/.readiness-${process.pid}-${crypto.randomUUID()}`;
  try {
    await Bun.write(probe, "ready");
  } finally {
    try {
      unlinkSync(probe);
    } catch {
      // If the write itself failed there is no probe to remove.
    }
  }
}

export async function assertApplicationReady(staticMode: boolean) {
  assertDatabaseReady();
  await assertUploadStorageReady();
  if (staticMode && !(await Bun.file(clientIndexPath).exists())) {
    throw new Error(`Static client index is missing: ${clientIndexPath}`);
  }
}
