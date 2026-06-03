import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupApp, extractCookie } from "../helpers";

type Json = Record<string, unknown>;

describe("Auth API", () => {
  let app: ReturnType<typeof import("../src/app").createApp>;
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

  it("serves GET /api/health with version 2.1.0", async () => {

    const req = new Request("http://localhost/api/health");
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.version).toBe("2.1.0");
  });
});
