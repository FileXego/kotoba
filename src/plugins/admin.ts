import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages, users } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { normalizePagination } from "../lib/pagination";
import { parsePositiveId } from "../lib/ids";
import { publishRealtime } from "../lib/realtime";

export const admin = new Elysia({ prefix: "/api/admin" })
  .guard(
    {
      beforeHandle({ currentUser, status }) {
        if (!currentUser?.isAdmin) return status(403, { success: false, error: "FORBIDDEN" });
      },
    },
    (app) =>
      app
        .get("/messages", async ({ query }) => {
          const { offset, limit } = normalizePagination(query.offset, query.limit, { defaultLimit: 50, maxLimit: 100 });
          const [list, count] = await Promise.all([
            db.select().from(messages).orderBy(desc(messages.createdAt), desc(messages.id)).limit(limit).offset(offset),
            db.$count(messages),
          ]);
          return { success: true, data: list, total: count, offset, limit };
        }, { query: t.Object({ offset: t.Optional(t.Numeric()), limit: t.Optional(t.Numeric()) }) })
        .patch("/messages/:id/restore", async ({ params, status }) => {
          const id = parsePositiveId(params.id);
          if (!id) return status(400, { success: false, error: "INVALID_ID" });
          const [msg] = await db.select({
            id: messages.id,
            parentId: messages.parentId,
            rootId: messages.rootId,
          }).from(messages).where(eq(messages.id, id)).limit(1);
          if (!msg) return status(404, { success: false, error: "NOT_FOUND" });
          await db.update(messages).set({ deleted: 0 }).where(eq(messages.id, id));
          publishRealtime({
            audience: "public",
            type: "message.restored",
            messageId: id,
            parentId: msg.parentId,
            rootId: msg.rootId,
            updatedAt: new Date().toISOString(),
          });
          return { success: true };
        }, { params: t.Object({ id: t.String() }) })
        .get("/users", async () => {
          const list = await db.select({
            id: users.id, username: users.username, email: users.email,
            isAdmin: users.isAdmin, createdAt: users.createdAt,
          }).from(users).orderBy(desc(users.createdAt));
          return { success: true, data: list };
        })
        .patch("/users/:id/admin", async ({ params, body, currentUser, status }) => {
          const targetId = parsePositiveId(params.id);
          if (!targetId) return status(400, { success: false, error: "INVALID_ID" });
          if (currentUser && currentUser.id === targetId) {
            return status(400, { success: false, error: "SELF_ADMIN" });
          }
          const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
          if (!target) return status(404, { success: false, error: "NOT_FOUND" });
          await db.update(users).set({ isAdmin: body.admin ? 1 : 0 }).where(eq(users.id, targetId));
          return { success: true };
        }, { params: t.Object({ id: t.String() }), body: t.Object({ admin: t.Boolean() }) })
  );
