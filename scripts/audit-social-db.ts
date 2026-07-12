import { Database } from "bun:sqlite";

type CountRow = { count: number };

const path = process.env.DB_PATH;
if (!path) {
  console.error("DB_PATH is required");
  process.exit(2);
}

const sqlite = new Database(path, { readonly: true });

function count(query: string) {
  return sqlite.query<CountRow, []>(query).get()?.count ?? 0;
}

try {
  sqlite.exec("PRAGMA foreign_keys = ON");
  const integrity = sqlite
    .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
    .get()?.integrity_check ?? "unknown";
  const foreignKeyViolations = sqlite.query("PRAGMA foreign_key_check").all().length;

  const result = {
    integrity,
    foreignKeyViolations,
    users: count("SELECT COUNT(*) AS count FROM users"),
    messages: count("SELECT COUNT(*) AS count FROM messages"),
    likes: count("SELECT COUNT(*) AS count FROM likes"),
    bookmarks: count("SELECT COUNT(*) AS count FROM bookmarks"),
    profiles: count("SELECT COUNT(*) AS count FROM profiles"),
    anonymousMessages: count(
      "SELECT COUNT(*) AS count FROM messages WHERE user_id IS NULL",
    ),
    orphanOwnership: count(`
      SELECT COUNT(*) AS count
      FROM messages AS message
      LEFT JOIN users AS owner ON owner.id = message.user_id
      WHERE message.user_id IS NOT NULL AND owner.id IS NULL
    `),
    orphanInteractions: count(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT 1
        FROM likes AS interaction
        LEFT JOIN users AS actor ON actor.id = interaction.user_id
        LEFT JOIN messages AS message ON message.id = interaction.message_id
        WHERE actor.id IS NULL OR message.id IS NULL
        UNION ALL
        SELECT 1
        FROM bookmarks AS interaction
        LEFT JOIN users AS actor ON actor.id = interaction.user_id
        LEFT JOIN messages AS message ON message.id = interaction.message_id
        WHERE actor.id IS NULL OR message.id IS NULL
      )
    `),
    invalidThreadLinks: count(`
      SELECT COUNT(*) AS count
      FROM messages AS message
      LEFT JOIN messages AS parent ON parent.id = message.parent_id
      LEFT JOIN messages AS root ON root.id = message.root_id
      WHERE
        (message.depth = 0 AND (message.parent_id IS NOT NULL OR message.root_id IS NOT NULL))
        OR (message.depth > 0 AND (parent.id IS NULL OR root.id IS NULL OR root.depth <> 0))
        OR (message.depth = 1 AND parent.depth <> 0)
        OR (message.depth = 2 AND parent.depth <> 1)
        OR message.depth NOT IN (0, 1, 2)
    `),
    migrationVersion: count("SELECT COUNT(*) AS count FROM __drizzle_migrations"),
  };

  console.log(JSON.stringify(result, null, 2));
  if (integrity !== "ok" || foreignKeyViolations > 0) {
    process.exitCode = 1;
  }
} catch {
  console.error("Database audit could not be completed");
  process.exitCode = 2;
} finally {
  sqlite.close();
}
