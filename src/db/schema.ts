import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  deleted: integer("deleted").notNull().default(0),
  parentId: integer("parent_id"),
  rootId: integer("root_id"),
  depth: integer("depth").notNull().default(0),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const likes = sqliteTable("likes", {
  userId: integer("user_id").notNull().references(() => users.id),
  messageId: integer("message_id").notNull().references(() => messages.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  unqLikes: unique().on(t.userId, t.messageId),
}));

export const bookmarks = sqliteTable("bookmarks", {
  userId: integer("user_id").notNull().references(() => users.id),
  messageId: integer("message_id").notNull().references(() => messages.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  unqBookmarks: unique().on(t.userId, t.messageId),
}));
