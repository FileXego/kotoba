import { Elysia, t } from "elysia";
import { signCookie, unsignCookie } from "elysia/utils";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { ensureUploadDir, uploadDir } from "../lib/files";
import { hasExpectedImageSignature, imageExtForMime } from "../lib/images";
import { resolveInsideDir } from "../lib/files";
import { uploadCapacity } from "../lib/upload-storage";
import { unlink } from "node:fs/promises";

const THEMES = new Set(["light", "dark", "sumi", "sakura"]);
const isProd = import.meta.env.NODE_ENV === "production";
const rawSecret = import.meta.env.COOKIE_SECRET;
if (!rawSecret || (isProd && (rawSecret === "dev-secret-change-me" || rawSecret.length < 32))) {
  if (isProd) {
    console.error("COOKIE_SECRET must be at least 32 characters and not the default dev value in production");
    process.exit(1);
  }
}
const COOKIE_SECRET = rawSecret ?? "dev-secret-change-me";
const SESSION_AGE = 60 * 60 * 24 * 7;
const TURNSTILE_SECRET = (() => {
  const s = import.meta.env.TURNSTILE_SECRET ?? "1x0000000000000000000000000000000AA";
  if (isProd && s === "1x0000000000000000000000000000000AA") {
    console.error("TURNSTILE_SECRET must be set to a real Cloudflare secret key in production");
    process.exit(1);
  }
  return s;
})();

// --- captcha verifier (boot-time fail-fast in production) ---
if (isProd && process.env.SKIP_CAPTCHA === "1") {
  console.error("SKIP_CAPTCHA is not allowed in production");
  process.exit(1);
}
const skipCaptcha = process.env.SKIP_CAPTCHA === "1";

async function verifyCaptcha(token: string) {
  if (skipCaptcha) return true;
  try {
    const fd = new FormData();
    fd.append("secret", TURNSTILE_SECRET);
    fd.append("response", token);
    const vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd })
      .then(r => r.json() as Promise<{ success?: boolean }>);
    return vr.success === true;
  } catch { return false; }
}

async function lookupUser(userId: number) {
  const [user] = await db
    .select({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin, avatarUrl: users.avatarUrl, signature: users.signature, theme: users.theme })
    .from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

const setSession = async (session: any, userId: number) => {
  const expiresAt = Date.now() + SESSION_AGE * 1_000;
  session.value = await signCookie(`${userId}:${expiresAt}`, COOKIE_SECRET);
  session.path = "/"; session.httpOnly = true; session.maxAge = SESSION_AGE;
  session.sameSite = "lax";
  session.secure = isProd;
};

const clearSession = (session: any) => {
  session.value = "";
  session.path = "/";
  session.httpOnly = true;
  session.maxAge = 0;
  session.sameSite = "lax";
  session.secure = isProd;
};

// Unsign + parse the session cookie. Tampered or malformed cookies yield null (logged out).
async function readSessionUserId(value: unknown): Promise<number | null> {
  if (typeof value !== "string" || value === "") return null;
  const unsigned = await unsignCookie(value, COOKIE_SECRET);
  if (unsigned === false) return null;
  const parts = unsigned.split(":");
  const uidPart = parts[0];
  const expiryPart = parts[1];
  if (parts.length !== 2 || !uidPart || !expiryPart || !/^[1-9]\d*$/.test(uidPart) || !/^\d+$/.test(expiryPart)) {
    return null;
  }
  const uid = Number(uidPart);
  const expiresAt = Number(expiryPart);
  if (!Number.isSafeInteger(uid) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }
  return uid;
}

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
    const uid = await readSessionUserId(session.value);
    if (uid === null) return { currentUser: null };
    return { currentUser: await lookupUser(uid) };
  })
  .post(
    "/sign-up",
    async ({ body, cookie: { session }, status }) => {
      if (!(await verifyCaptcha(body.captchaToken))) {
        return status(429, { success: false, error: "CAPTCHA_FAIL" });
      }
      const passwordHash = await Bun.password.hash(body.password);
      const [user] = await db.insert(users).values({
        username: body.username, email: body.email, passwordHash,
      }).onConflictDoNothing().returning({ id: users.id, username: users.username, email: users.email, isAdmin: users.isAdmin, avatarUrl: users.avatarUrl, signature: users.signature, theme: users.theme });
      if (!user) return status(409, { success: false, error: "DUPLICATE" });
      await setSession(session!, user.id);
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
      await setSession(session!, user.id);
      const { passwordHash: _, ...safe } = user;
      return { success: true, user: safe };
    },
    { body: "signIn" }
  )
  .post("/sign-out", ({ cookie: { session } }) => {
    clearSession(session!);
    return { success: true };
  })
  .get("/me", async ({ cookie: { session } }) => {
    const uid = await readSessionUserId(session?.value);
    if (uid === null) return { success: true, user: null };
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
    const ext = imageExtForMime(file.type);
    if (!ext || !(await hasExpectedImageSignature(file))) {
      return status(400, { success: false, error: "INVALID_FILE_TYPE" });
    }
    const reservation = await uploadCapacity.reserve(file.size);
    if (!reservation) return status(507, { success: false, error: "STORAGE_LIMIT" });
    ensureUploadDir();
    const filename = `avatar-${currentUser.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filepath = uploadDir + "/" + filename;
    const avatarUrl = `/uploads/${filename}`;
    try {
      await Bun.write(filepath, file);
      await db.update(users).set({ avatarUrl }).where(eq(users.id, currentUser.id));
      await reservation.commit();
    } catch (error) {
      await reservation.release();
      await unlink(filepath).catch(() => undefined);
      console.error("Avatar update failed:", error instanceof Error ? error.message : String(error));
      return status(500, { success: false, error: "INTERNAL_ERROR" });
    }

    const oldAvatar = currentUser.avatarUrl;
    const match = oldAvatar?.match(/^\/uploads\/(avatar-(\d+)-[A-Za-z0-9._-]+\.(?:png|jpg|webp))$/);
    if (match && Number(match[2]) === currentUser.id) {
      const oldPath = resolveInsideDir(uploadDir, match[1]!);
      if (oldPath && oldPath !== filepath) await unlink(oldPath).catch(() => undefined);
    }
    return { success: true, user: await lookupUser(currentUser.id) };
  }, {
    body: t.Object({ file: t.File({ format: "image/png, image/jpeg, image/webp", maxSize: 256 * 1024 }) }),
  })
  ;
