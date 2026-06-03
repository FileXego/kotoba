import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const DB_PATH = process.env.TEST_DB || "sqlite.db";

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
