import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const DB_PATH = process.env.TEST_DB || process.env.DB_PATH || "sqlite.db";

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
