import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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
  userId: integer("user_id").references(() => users.id),
  visibility: text("visibility").notNull().default("public"),
  audienceAnchorUserId: integer("audience_anchor_user_id").references(() => users.id),
  moderationState: text("moderation_state").notNull().default("published"),
  contentVersion: integer("content_version").notNull().default(1),
  replyPolicy: text("reply_policy").notNull().default("viewer"),
  clientRequestId: text("client_request_id"),
}, (t) => ({
  listIdx: index("messages_list_idx").on(t.deleted, t.parentId, t.createdAt),
  rootIdx: index("messages_root_idx").on(t.rootId, t.createdAt),
  feedIdx: index("messages_feed_idx").on(
    t.deleted,
    t.moderationState,
    t.visibility,
    t.parentId,
    t.createdAt,
  ),
  authorCreatedIdx: index("messages_author_created_idx").on(t.userId, t.createdAt),
  clientRequestUnique: unique("messages_user_client_request_unique").on(
    t.userId,
    t.clientRequestId,
  ),
}));

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  avatarUrl: text("avatar_url"),
  signature: text("signature"),
  theme: text("theme").notNull().default("light"),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
});

export const profiles = sqliteTable("profiles", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  signature: text("signature"),
  edition: text("edition").notNull().default("light"),
  sealColor: text("seal_color").notNull().default("cinnabar"),
  paper: text("paper").notNull().default("balanced"),
  titleFace: text("title_face").notNull().default("song"),
  defaultVisibility: text("default_visibility").notNull().default("public"),
  defaultReplyPolicy: text("default_reply_policy").notNull().default("viewer"),
  activityAudience: text("activity_audience").notNull().default("public"),
  discoverable: integer("discoverable").notNull().default(1),
  externalIndexing: integer("external_indexing").notNull().default(0),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  displayNameIdx: index("profiles_display_name_idx").on(t.displayName),
}));

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  csrfHash: text("csrf_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  userAgent: text("user_agent"),
}, (t) => ({
  userActivityIdx: index("sessions_user_activity_idx").on(
    t.userId,
    t.revokedAt,
    t.expiresAt,
  ),
}));

export const follows = sqliteTable("follows", {
  followerId: integer("follower_id").notNull().references(() => users.id),
  followedId: integer("followed_id").notNull().references(() => users.id),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  pairUnique: unique("follows_pair_unique").on(t.followerId, t.followedId),
  noSelf: check("follows_no_self", sql`${t.followerId} <> ${t.followedId}`),
  followedActiveIdx: index("follows_followed_active_idx").on(t.followedId, t.active),
}));

export const mutes = sqliteTable("mutes", {
  muterId: integer("muter_id").notNull().references(() => users.id),
  mutedId: integer("muted_id").notNull().references(() => users.id),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  pairUnique: unique("mutes_pair_unique").on(t.muterId, t.mutedId),
  noSelf: check("mutes_no_self", sql`${t.muterId} <> ${t.mutedId}`),
  muterActiveIdx: index("mutes_muter_active_idx").on(t.muterId, t.active),
}));

export const blocks = sqliteTable("blocks", {
  blockerId: integer("blocker_id").notNull().references(() => users.id),
  blockedId: integer("blocked_id").notNull().references(() => users.id),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  pairUnique: unique("blocks_pair_unique").on(t.blockerId, t.blockedId),
  noSelf: check("blocks_no_self", sql`${t.blockerId} <> ${t.blockedId}`),
  blockerActiveIdx: index("blocks_blocker_active_idx").on(t.blockerId, t.active),
  blockedActiveIdx: index("blocks_blocked_active_idx").on(t.blockedId, t.active),
}));

export const likes = sqliteTable("likes", {
  userId: integer("user_id").notNull().references(() => users.id),
  messageId: integer("message_id").notNull().references(() => messages.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  unqLikes: unique().on(t.userId, t.messageId),
  msgIdx: index("likes_message_idx").on(t.messageId),
}));

export const bookmarks = sqliteTable("bookmarks", {
  userId: integer("user_id").notNull().references(() => users.id),
  messageId: integer("message_id").notNull().references(() => messages.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => ({
  unqBookmarks: unique().on(t.userId, t.messageId),
  msgIdx: index("bookmarks_message_idx").on(t.messageId),
  userCreatedIdx: index("bookmarks_user_created_idx").on(t.userId, t.createdAt),
}));
