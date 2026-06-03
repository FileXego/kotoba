import { beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";

// ===== env setup: MUST be set BEFORE any app imports =====
const TEST_DB = `testbug/.test-${Date.now()}.db`;
process.env.TEST_DB = TEST_DB;
process.env.COOKIE_SECRET = "test-secret";
process.env.TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
// =========================================================

let app: ReturnType<typeof import("../src/app").createApp>;

/**
 * Create a fresh test database with all tables (mirrors drizzle migrations),
 * then import and build the Elysia app. Call once per describe block.
 */
export async function setupApp() {
  const sqlite = new Database(TEST_DB);
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL,
      avatar_url TEXT,
      signature TEXT,
      theme TEXT DEFAULT 'light' NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      deleted INTEGER DEFAULT 0 NOT NULL,
      parent_id INTEGER,
      root_id INTEGER,
      depth INTEGER DEFAULT 0 NOT NULL,
      user_id INTEGER REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS messages_list_idx ON messages (deleted, parent_id, created_at);
    CREATE INDEX IF NOT EXISTS messages_root_idx ON messages (root_id, created_at);

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER NOT NULL REFERENCES users(id),
      message_id INTEGER NOT NULL REFERENCES messages(id),
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_id_message_id_unique ON bookmarks (user_id, message_id);
    CREATE INDEX IF NOT EXISTS bookmarks_message_idx ON bookmarks (message_id);
    CREATE INDEX IF NOT EXISTS bookmarks_user_created_idx ON bookmarks (user_id, created_at);

    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      message_id INTEGER NOT NULL REFERENCES messages(id),
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS likes_user_id_message_id_unique ON likes (user_id, message_id);
    CREATE INDEX IF NOT EXISTS likes_message_idx ON likes (message_id);
  `);
  sqlite.close();

  const { createApp } = await import("../src/app");
  app = createApp({ staticMode: false });
  return app;
}

/** Return the singleton app instance (set after setupApp()). */
export function getApp() {
  if (!app) throw new Error("setupApp() must be called before getApp()");
  return app;
}

/** Remove the temporary test DB file. Call in afterAll. */
export function cleanup() {
  try {
    unlinkSync(resolve(TEST_DB));
  } catch {
    // file already gone or never created — ignore
  }
}

/** Extract the session cookie value from a Set-Cookie header. */
export function extractCookie(res: Response): string | null {
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}
