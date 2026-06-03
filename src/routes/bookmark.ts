import { Elysia, t } from "elysia";
import { db } from "../db";
import { bookmarks, messages, users, likes } from "../db/schema";
import { desc, eq, and, sql } from "drizzle-orm";

export const bookmarkRoute = new Elysia({ prefix: "/api" })
  .get(
    "/bookmarks",
    async ({ query, currentUser, status }) => {
      if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 20;
      const [rows, countRow] = await Promise.all([
        db.select({
          id: messages.id, name: messages.name, content: messages.content,
          createdAt: messages.createdAt, updatedAt: messages.updatedAt,
          userId: messages.userId, avatarUrl: users.avatarUrl, signature: users.signature,
          likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.message_id = messages.id)`,
        }).from(bookmarks)
          .innerJoin(messages, eq(bookmarks.messageId, messages.id))
          .leftJoin(users, eq(messages.userId, users.id))
          .where(and(eq(bookmarks.userId, currentUser.id), eq(messages.deleted, 0)))
          .orderBy(desc(bookmarks.createdAt))
          .limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bookmarks)
          .innerJoin(messages, eq(bookmarks.messageId, messages.id))
          .where(and(eq(bookmarks.userId, currentUser.id), eq(messages.deleted, 0))),
      ]);
      const count = countRow[0]?.count ?? 0;
      const data = rows.map(r => ({
        ...r,
        signature: (currentUser && (currentUser.id === r.userId || (r.userId == null && currentUser.username === r.name))) ? r.signature : null,
      }));
      return { success: true, data, total: count, offset, limit };
    },
    { query: t.Object({ offset: t.Optional(t.Numeric()), limit: t.Optional(t.Numeric()) }) }
  );
