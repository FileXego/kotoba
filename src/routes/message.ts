import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages, likes, bookmarks, users } from "../db/schema";
import { desc, eq, and, isNull, or, like, sql } from "drizzle-orm";
import { normalizePagination, SEARCH_MAX_LENGTH } from "../lib/pagination";
import { parsePositiveId } from "../lib/ids";

const MAX_DEPTH = 2;

export const messageRoute = new Elysia({ prefix: "/api" })
  .post(
    "/message",
    async ({ body, currentUser, status }) => {
      if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
      let depth = 0;
      let rootId: number | null = null;
      if (body.parentId !== undefined) {
        const [parent] = await db
          .select({ id: messages.id, depth: messages.depth, rootId: messages.rootId })
          .from(messages)
          .where(and(eq(messages.id, body.parentId), eq(messages.deleted, 0)))
          .limit(1);
        if (!parent) return status(400, { success: false, error: "PARENT_NOT_FOUND" });
        if (parent.depth >= MAX_DEPTH) return status(409, { success: false, error: "MAX_DEPTH" });
        depth = parent.depth + 1;
        rootId = parent.rootId ?? parent.id;
      }
      const [result] = await db.insert(messages).values({
        name: currentUser.username,
        content: body.content,
        userId: currentUser.id,
        parentId: body.parentId ?? null,
        rootId,
        depth,
      }).returning({ id: messages.id });
      return { success: true, id: result.id };
    },
    { body: t.Object({ content: t.String({ minLength: 1, maxLength: 500 }), parentId: t.Optional(t.Number()) }) }
  )
  .get(
    "/messages",
    async ({ query, currentUser }) => {
      const { offset, limit } = normalizePagination(query.offset, query.limit, { defaultLimit: 20, maxLimit: 50 });
      const q = query.q?.trim();
      const where = and(
        eq(messages.deleted, 0), isNull(messages.parentId),
        q ? or(like(messages.name, `%${q}%`), like(messages.content, `%${q}%`)) : undefined
      );
      const [rows, count] = await Promise.all([
        db.select({
          id: messages.id, name: messages.name, content: messages.content,
          createdAt: messages.createdAt, updatedAt: messages.updatedAt,
          parentId: messages.parentId, rootId: messages.rootId, depth: messages.depth,
          userId: messages.userId, avatarUrl: users.avatarUrl, signature: users.signature,
          likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.message_id = messages.id)`,
        }).from(messages)
          .leftJoin(users, eq(messages.userId, users.id))
          .where(where).orderBy(desc(messages.createdAt)).limit(limit).offset(offset),
        db.$count(messages, where),
      ]);
      const data = rows.map(r => ({
        ...r,
        signature: (currentUser && (currentUser.id === r.userId || (r.userId == null && currentUser.username === r.name))) ? r.signature : null,
      }));
      return { success: true, data, total: count, offset, limit };
    },
    { query: t.Object({ offset: t.Optional(t.Numeric()), limit: t.Optional(t.Numeric()), q: t.Optional(t.String({ maxLength: SEARCH_MAX_LENGTH })) }) }
  )
  .get(
    "/messages/:id/replies",
    async ({ params, currentUser, status }) => {
      const id = parsePositiveId(params.id);
      if (!id) return status(400, { success: false, error: "INVALID_ID" });
      const rows = await db.select({
        id: messages.id, name: messages.name, content: messages.content,
        createdAt: messages.createdAt, updatedAt: messages.updatedAt,
        parentId: messages.parentId, rootId: messages.rootId, depth: messages.depth,
        userId: messages.userId, avatarUrl: users.avatarUrl, signature: users.signature,
        likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.message_id = messages.id)`,
      }).from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(and(eq(messages.deleted, 0), or(eq(messages.rootId, id), eq(messages.id, id))))
        .orderBy(messages.createdAt);
      const data = rows.map(r => ({
        ...r,
        signature: (currentUser && (currentUser.id === r.userId || (r.userId == null && currentUser.username === r.name))) ? r.signature : null,
      }));
      return { success: true, data };
    },
    { params: t.Object({ id: t.String() }) }
  )
  .patch(
    "/message/:id",
    async ({ params, body, currentUser, status }) => {
      const id = parsePositiveId(params.id);
      if (!id) return status(400, { success: false, error: "INVALID_ID" });
      const [msg] = await db.select({ userId: messages.userId, name: messages.name }).from(messages).where(eq(messages.id, id)).limit(1);
      if (!msg) return status(404, { success: false, error: "NOT_FOUND" });
      const isAuthor = !!currentUser && (
        (msg.userId != null && msg.userId === currentUser.id)
        || (msg.userId == null && msg.name === currentUser.username)
      );
      // Admins can soft-delete any message (set deleted=1), but cannot edit content of others' messages
      const isAdminDelete = !!currentUser?.isAdmin && body.deleted === 1 && body.content === undefined;
      if (!isAuthor && !isAdminDelete) {
        return status(403, { success: false, error: "FORBIDDEN" });
      }
      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (body.content !== undefined) update.content = body.content;
      if (body.deleted !== undefined) update.deleted = body.deleted;
      await db.update(messages).set(update).where(eq(messages.id, id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }), body: t.Object({ content: t.Optional(t.String({ minLength: 1, maxLength: 500 })), deleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })) }) }
  )
  .post(
    "/messages/:id/like",
    async ({ params, currentUser, status }) => {
      if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
      const messageId = parsePositiveId(params.id);
      if (!messageId) return status(422, { success: false, error: "INVALID_ID" });
      const [msg] = await db.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.id, messageId), eq(messages.deleted, 0))).limit(1);
      if (!msg) return status(404, { success: false, error: "NOT_FOUND" });
      const [existing] = await db.select().from(likes).where(and(eq(likes.userId, currentUser.id), eq(likes.messageId, messageId))).limit(1);
      if (existing) {
        await db.delete(likes).where(and(eq(likes.userId, currentUser.id), eq(likes.messageId, messageId)));
      } else {
        await db.insert(likes).values({ userId: currentUser.id, messageId });
      }
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(likes).where(eq(likes.messageId, messageId));
      return { success: true, liked: !existing, count };
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/messages/:id/bookmark",
    async ({ params, currentUser, status }) => {
      if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
      const messageId = parsePositiveId(params.id);
      if (!messageId) return status(422, { success: false, error: "INVALID_ID" });
      const [msg] = await db.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.id, messageId), eq(messages.deleted, 0))).limit(1);
      if (!msg) return status(404, { success: false, error: "NOT_FOUND" });
      const [existing] = await db.select().from(bookmarks).where(and(eq(bookmarks.userId, currentUser.id), eq(bookmarks.messageId, messageId))).limit(1);
      if (existing) {
        await db.delete(bookmarks).where(and(eq(bookmarks.userId, currentUser.id), eq(bookmarks.messageId, messageId)));
      } else {
        await db.insert(bookmarks).values({ userId: currentUser.id, messageId });
      }
      return { success: true, bookmarked: !existing };
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    "/me/likes",
    async ({ currentUser }) => {
      if (!currentUser) return { success: true, liked: [], bookmarked: [] };
      const [likedRows, bookmarkedRows] = await Promise.all([
        db.select({ messageId: likes.messageId }).from(likes).where(eq(likes.userId, currentUser.id)),
        db.select({ messageId: bookmarks.messageId }).from(bookmarks).where(eq(bookmarks.userId, currentUser.id)),
      ]);
      return { success: true, liked: likedRows.map((r) => r.messageId), bookmarked: bookmarkedRows.map((r) => r.messageId) };
    }
  );
