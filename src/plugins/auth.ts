import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const COOKIE_SECRET = import.meta.env.COOKIE_SECRET ?? "dev-secret-change-me";
const SESSION_AGE = 60 * 60 * 24 * 7;

async function lookupUser(userId: number) {
  const [user] = await db
    .select({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin })
    .from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

const setSession = (session: any, userId: number) => {
  session.value = String(userId); session.secret = COOKIE_SECRET;
  session.path = "/"; session.httpOnly = true; session.maxAge = SESSION_AGE;
};

export const auth = new Elysia({ prefix: "/api/auth" })
  .model({
    signUp: t.Object({
      username: t.String({ minLength: 1, maxLength: 30 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 6 }),
    }),
    signIn: t.Object({
      username: t.String(),
      password: t.String(),
    }),
  })
  .post(
    "/sign-up",
    async ({ body, cookie: { session }, set }) => {
      const passwordHash = await Bun.password.hash(body.password);
      const [user] = await db.insert(users).values({
        username: body.username, email: body.email, passwordHash,
      }).onConflictDoNothing().returning({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin });
      if (!user) { set.status = 409; return { success: false, error: "DUPLICATE" }; }
      setSession(session, user.id);
      return { success: true, user };
    },
    { body: "signUp" }
  )
  .post(
    "/sign-in",
    async ({ body, cookie: { session }, set }) => {
      const [user] = await db
        .select({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin, passwordHash: users.passwordHash })
        .from(users).where(eq(users.username, body.username)).limit(1);
      if (!user || !(await Bun.password.verify(body.password, user.passwordHash))) {
        set.status = 401; return { success: false, error: "INVALID_CREDENTIALS" };
      }
      session.value = String(user.id);
      session.secret = COOKIE_SECRET;
      session.path = "/";
      session.httpOnly = true;
      session.maxAge = SESSION_AGE;
      const { passwordHash: _, ...safe } = user;
      return { success: true, user: safe };
    },
    { body: "signIn" }
  )
  .post("/sign-out", ({ cookie: { session } }) => { session.value = ""; session.maxAge = 0; return { success: true }; })
  .get("/me", async ({ cookie: { session } }) => {
    if (session.value == null || session.value === "") return { success: true, user: null };
    const uid = Number(session.value);
    if (isNaN(uid)) return { success: true, user: null };
    return { success: true, user: await lookupUser(uid) };
  })
  .derive({ as: "global" }, async ({ cookie: { session } }) => {
    if (session.value == null || session.value === "") return { currentUser: null };
    const uid = Number(session.value);
    if (isNaN(uid)) return { currentUser: null };
    return { currentUser: await lookupUser(uid) };
  });
