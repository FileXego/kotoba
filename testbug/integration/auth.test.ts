import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { signCookie } from "elysia/utils";
import { setupApp, extractCookie } from "../helpers";

type Json = Record<string, unknown>;

describe("Auth API", () => {
  let app: Awaited<ReturnType<typeof import("../../src/app").createApp>>;
  let cleanup: () => void;
  let cookie: string | null = null;

  beforeAll(async () => {
    const result = await setupApp();
    app = result.app;
    cleanup = result.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  // ── Sign-up ──────────────────────────────────────────────────────

  it("signs up a new user", async () => {
    const req = new Request("http://localhost/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test",
        email: "test@test.com",
        password: "123456",
        captchaToken: "test-token",
      }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.user as Record<string, unknown>).username).toBe("test");
  });

  it("rejects duplicate sign-up (same username+email)", async () => {

    const req = new Request("http://localhost/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test",
        email: "test@test.com",
        password: "123456",
        captchaToken: "test-token",
      }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe("DUPLICATE");
  });

  it("signs up with a valid captcha token", async () => {

    const req = new Request("http://localhost/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test2",
        email: "test2@test.com",
        password: "123456",
        captchaToken: "test-token",
      }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("validates the original password before any output escaping", async () => {
    const res = await app.handle(new Request("http://localhost/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "short-password",
        email: "short-password@test.com",
        password: "&&",
        captchaToken: "test-token",
      }),
    }));
    const data = await res.json() as Json;
    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error).toBe("VALIDATION");
  });

  it("preserves valid credentials instead of rewriting them as HTML entities", async () => {
    const username = "special&user";
    const password = "<>&\"'!";
    const signup = await app.handle(new Request("http://localhost/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        email: "special-user@test.com",
        password,
        captchaToken: "test-token",
      }),
    }));
    const signupData = await signup.json() as Json;
    expect(signup.status).toBe(200);
    expect((signupData.user as Record<string, unknown>).username).toBe(username);

    const signin = await app.handle(new Request("http://localhost/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }));
    expect(signin.status).toBe(200);
  });

  // ── Sign-in ──────────────────────────────────────────────────────

  it("signs in with correct credentials", async () => {

    const req = new Request("http://localhost/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test", password: "123456" }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.user as Record<string, unknown>).username).toBe("test");
    expect((data.user as Record<string, unknown>).email).toBe("test@test.com");
    // password_hash must NOT leak
    expect((data.user as Record<string, unknown>).passwordHash).toBeUndefined();

    // Save session cookie for subsequent authenticated requests
    cookie = extractCookie(res);
    expect(cookie).not.toBeNull();
    expect(cookie).not.toMatch(/^session=\d+$/);
    expect(cookie!.length).toBeGreaterThan("session=1".length);
  });

  it("rejects sign-in with wrong password", async () => {

    const req = new Request("http://localhost/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test", password: "wrong-password" }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("INVALID_CREDENTIALS");
  });

  // ── GET /me (unauthenticated) ────────────────────────────────────

  it("returns null user for GET /me without cookie", async () => {

    const req = new Request("http://localhost/api/auth/me");
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toBeNull();
  });

  // ── GET /me (authenticated) ──────────────────────────────────────

  it("returns user for GET /me with valid session cookie", async () => {

    const req = new Request("http://localhost/api/auth/me", {
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).not.toBeNull();
    expect((data.user as Record<string, unknown>).username).toBe("test");
  });

  it("rejects forged and tampered session cookies", async () => {
    const signedValue = cookie!.slice("session=".length);
    const last = signedValue.at(-1);
    const tamperedValue = `${signedValue.slice(0, -1)}${last === "a" ? "b" : "a"}`;

    for (const forged of ["session=1", `session=${tamperedValue}`]) {
      const res = await app.handle(new Request("http://localhost/api/auth/me", {
        headers: { Cookie: forged },
      }));
      const data = await res.json() as Json;
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeNull();
    }
  });

  it("rejects a signed legacy numeric session that has no server-side expiry", async () => {
    const legacyValue = await signCookie("1.0", "test-secret");
    const res = await app.handle(new Request("http://localhost/api/auth/me", {
      headers: { Cookie: `session=${legacyValue}` },
    }));
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.user).toBeNull();
  });

  it("rejects a correctly signed but expired structured session", async () => {
    const expiredValue = await signCookie(`1:${Date.now() - 1_000}`, "test-secret");
    const res = await app.handle(new Request("http://localhost/api/auth/me", {
      headers: { Cookie: `session=${expiredValue}` },
    }));
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.user).toBeNull();
  });

  it("does not authorize a forged numeric cookie for admin routes", async () => {
    const res = await app.handle(new Request("http://localhost/api/admin/users", {
      headers: { Cookie: "session=1" },
    }));
    const data = await res.json() as Json;
    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });

  // ── PATCH /me ────────────────────────────────────────────────────

  it("updates signature via PATCH /me (≤100 chars)", async () => {

    const req = new Request("http://localhost/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({ signature: "Hello world" }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.user as Record<string, unknown>).signature).toBe("Hello world");
  });

  it("rejects PATCH /me with signature > 100 chars", async () => {

    const req = new Request("http://localhost/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({ signature: "x".repeat(101) }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("INVALID_PROFILE");
  });

  it("rejects PATCH /me with invalid theme", async () => {

    const req = new Request("http://localhost/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({ theme: "invalid-theme" }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("INVALID_THEME");
  });

  it("updates to a valid theme via PATCH /me", async () => {

    const req = new Request("http://localhost/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({ theme: "sakura" }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.user as Record<string, unknown>).theme).toBe("sakura");
  });

  // ── Sign-out ─────────────────────────────────────────────────────

  it("signs out and clears session cookie", async () => {

    const req = new Request("http://localhost/api/auth/sign-out", {
      method: "POST",
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Path=/");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("returns null user for GET /me after sign-out", async () => {

    const req = new Request("http://localhost/api/auth/me");
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toBeNull();
  });

  // ── Health check ─────────────────────────────────────────────────

  it("serves GET /api/health with the canonical release version", async () => {

    const req = new Request("http://localhost/api/health");
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.version).toBe("2.1.2");
    expect(data.status).toBe("ready");
    expect(typeof data.revision).toBe("string");
  });
});
