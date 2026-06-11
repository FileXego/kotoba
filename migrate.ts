import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database(process.env.DB_PATH || "sqlite.db");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA busy_timeout = 5000");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle/migrations" });

console.log("✅ 数据库迁移完成");
sqlite.close();
