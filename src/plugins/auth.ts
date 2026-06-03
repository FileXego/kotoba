import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { mkdirSync } from "node:fs";

const THEMES = new Set(["light", "dark", "sumi", "sakura"]);
const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const UPLOAD_DIR = import.meta.dir + "/../../uploads";
const isProd = import.meta.env.NODE_ENV === "production";
const rawSecret = import.meta.env.COOKIE_SECRET;
if (!rawSecret) {
  if (isProd) { console.error("COOKIE_SECRET is required in production"); process.exit(1); }
}
const COOKIE_SECRET = rawSecret ?? "dev-secret-change-me";
const SESSION_AGE = 60 * 60 * 24 * 7;
const TURNSTILE_SECRET = import.meta.env.TURNSTILE_SECRET ?? "1x0000000000000000000000000000000AA";

async function lookupUser(userId: number) {
  const [user] = await db
    .select({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin, avatarUrl: users.avatarUrl, signature: users.signature, theme: users.theme })
    .from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

const setSession = (session: any, userId: number) => {
  session.value = String(userId); session.secret = COOKIE_SECRET;
  session.path = "/"; session.httpOnly = true; session.maxAge = SESSION_AGE;
  session.sameSite = "lax";
  session.secure = isProd;
};

export const auth = new Elysia({ prefix: "/api/auth" })
  .model({
    signUp: t.Object({
      username: t.String({ minLength: 1, maxLength: 30 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 6 }),
      captchaToken: t.String(),
    }),
    signIn: t.Object({
      username: t.String(),
      password: t.String(),
    }),
    patchMe: t.Object({
      signature: t.Optional(t.String()),
      theme: t.Optional(t.String()),
    }),
  })
  .derive({ as: "global" }, async ({ cookie: { session } }) => {
    if (session.value == null || session.value === "") return { currentUser: null };
    const uid = Number(session.value);
    if (isNaN(uid)) return { currentUser: null };
    return { currentUser: await lookupUser(uid) };
  })
  .post(
    "/sign-up",
    async ({ body, cookie: { session }, status }) => {
      try {
        const fd = new FormData();
        fd.append("secret", TURNSTILE_SECRET);
        fd.append("response", body.captchaToken);
        const vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd }).then(r => r.json());
        if (!vr.success) return status(429, { success: false, error: "CAPTCHA_FAIL" });
      } catch { return status(429, { success: false, error: "CAPTCHA_FAIL" }); }

      const passwordHash = await Bun.password.hash(body.password);
      const [user] = await db.insert(users).values({
        username: body.username, email: body.email, passwordHash,
      }).onConflictDoNothing().returning({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin, avatarUrl: users.avatarUrl, signature: users.signature, theme: users.theme });
      if (!user) return status(409, { success: false, error: "DUPLICATE" });
      setSession(session, user.id);
      return { success: true, user };
    },
    { body: "signUp" }
  )
  .post(
    "/sign-in",
    async ({ body, cookie: { session }, status }) => {
      const [user] = await db
        .select({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin, passwordHash: users.passwordHash, avatarUrl: users.avatarUrl, signature: users.signature, theme: users.theme })
        .from(users).where(eq(users.username, body.username)).limit(1);
      if (!user || !(await Bun.password.verify(body.password, user.passwordHash))) {
        return status(401, { success: false, error: "INVALID_CREDENTIALS" });
      }
      setSession(session, user.id);
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
  // PATCH /me — partial profile update
  .patch("/me", async ({ body, currentUser, status }) => {
    if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
    const update: Record<string, unknown> = {};
    if (body.signature !== undefined) {
      if ((body.signature?.length ?? 0) > 100) return status(400, { success: false, error: "INVALID_PROFILE" });
      update.signature = body.signature;
    }
    if (body.theme !== undefined) {
      if (body.theme !== undefined && !THEMES.has(body.theme)) return status(400, { success: false, error: "INVALID_THEME" });
      update.theme = body.theme;
    }
    if (Object.keys(update).length === 0) return { success: true, user: currentUser };
    await db.update(users).set(update).where(eq(users.id, currentUser.id));
    return { success: true, user: await lookupUser(currentUser.id) };
  }, { body: "patchMe" })
  // PATCH /avatar — upload avatar
  .patch("/avatar", async ({ body: { file }, currentUser, status }) => {
    if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = MIME_EXT[file.type] ?? "jpg";
    const filename = `avatar-${currentUser.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    await Bun.write(UPLOAD_DIR + "/" + filename, file);
    const avatarUrl = `/uploads/${filename}`;
    await db.update(users).set({ avatarUrl }).where(eq(users.id, currentUser.id));
    return { success: true, user: await lookupUser(currentUser.id) };
  }, {
    body: t.Object({ file: t.File({ format: "image/png, image/jpeg, image/webp", maxSize: 256 * 1024 }) }),
  })
  ;
