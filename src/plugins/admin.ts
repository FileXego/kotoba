import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages, users } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const admin = new Elysia({ prefix: "/admin" })
  .guard(
    {
      beforeHandle({ currentUser, status }) {
        if (!currentUser?.isAdmin) return status(403, { success: false, error: "FORBIDDEN" });
      },
    },
    (app) =>
      app
        .get("/messages", async ({ query }) => {
          const offset = query.offset ?? 0;
          const limit = query.limit ?? 50;
          const [list, [{ count }]] = await Promise.all([
            db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit).offset(offset),
            db.$count(messages),
          ]);
          return { success: true, data: list, total: count, offset, limit };
        }, { query: t.Object({ offset: t.Optional(t.Numeric()), limit: t.Optional(t.Numeric()) }) })
        .patch("/messages/:id/restore", async ({ params, set }) => {
          const id = Number(params.id);
          if (isNaN(id)) { set.status = 400; return { success: false, error: "INVALID_ID" }; }
          await db.update(messages).set({ deleted: 0 }).where(eq(messages.id, id));
          return { success: true };
        }, { params: t.Object({ id: t.String() }) })
        .delete("/messages/:id", async ({ params, set }) => {
          const id = Number(params.id);
          if (isNaN(id)) { set.status = 400; return { success: false, error: "INVALID_ID" }; }
          await db.delete(messages).where(eq(messages.id, id));
          return { success: true };
        }, { params: t.Object({ id: t.String() }) })
        .get("/users", async () => {
          const list = await db.select({
            id: users.id, username: users.username, email: users.email,
            isAdmin: users.isAdmin, createdAt: users.createdAt,
          }).from(users).orderBy(desc(users.createdAt));
          return { success: true, data: list };
        })
        .patch("/users/:id/admin", async ({ params, body, currentUser, set }) => {
          const targetId = Number(params.id);
          if (isNaN(targetId)) { set.status = 400; return { success: false, error: "INVALID_ID" }; }
          if (currentUser && currentUser.id === targetId) {
            set.status = 400; return { success: false, error: "SELF_ADMIN" };
          }
          await db.update(users).set({ isAdmin: body.admin ? 1 : 0 }).where(eq(users.id, targetId));
          return { success: true };
        }, {
          params: t.Object({ id: t.String() }),
          body: t.Object({ admin: t.Boolean() }),
        })
  );