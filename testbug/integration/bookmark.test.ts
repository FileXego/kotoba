import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupApp, extractCookie } from "../helpers";

type Json = Record<string, unknown>;

describe("Bookmarks", () => {
  let app: ReturnType<typeof import("../src/app").createApp>;
  let cleanup: () => void;
  let cookie: string | null = null;
  let userId: number;
  const messageIds: number[] = [];

  beforeAll(async () => {
    const result = await setupApp();
    app = result.app;
    cleanup = result.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  // ── Test 1: 401 without auth ──────────────────────────────────────

  it("returns 401 for GET /bookmarks without auth", async () => {

    const req = new Request("http://localhost/api/bookmarks");
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("AUTH_REQUIRED");
  });

  // ── Sign up ───────────────────────────────────────────────────────

  it("signs up a new user for bookmark tests", async () => {

    const req = new Request("http://localhost/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "bookmarkuser",
        email: "bookmark@test.com",
        password: "123456",
        captchaToken: "test-token",
      }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.user as Record<string, unknown>).username).toBe("bookmarkuser");

    cookie = extractCookie(res);
    expect(cookie).not.toBeNull();

    userId = (data.user as Record<string, unknown>).id as number;
    expect(userId).toBeGreaterThan(0);
  });

  // ── Test 2: GET /bookmarks with auth, no bookmarks ────────────────

  it("returns empty list when no bookmarks exist (total=0)", async () => {

    const req = new Request("http://localhost/api/bookmarks", {
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
    expect(data.total).toBe(0);
  });

  // ── Set signature for field verification ──────────────────────────

  it("sets a signature via PATCH /auth/me for field coverage", async () => {

    const req = new Request("http://localhost/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({ signature: "My bookmark test signature" }),
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.user as Record<string, unknown>).signature).toBe("My bookmark test signature");
  });

  // ── Create 3 messages ─────────────────────────────────────────────

  it("creates 3 messages for bookmark testing", async () => {

    for (let i = 1; i <= 3; i++) {
      const req = new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie! },
        body: JSON.stringify({ content: `Bookmark test message ${i}` }),
      });
      const res = await app.handle(req);
      const data = await res.json() as Json;
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(typeof data.id).toBe("number");
      messageIds.push(data.id as number);
    }
    expect(messageIds).toHaveLength(3);
  });

  // ── Bookmark 1st message only ────────────────────────────────────

  it("bookmarks the 1st message", async () => {

    const req = new Request(`http://localhost/api/messages/${messageIds[0]}/bookmark`, {
      method: "POST",
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bookmarked).toBe(true);
  });

  // ── Test 3: GET /bookmarks has 1 item, total=1 ────────────────────
  // ── Test 5: fields (userId, avatarUrl, signature) present ─────────

  it("returns 1 bookmark after bookmarking one message (total=1) with correct fields", async () => {

    const req = new Request("http://localhost/api/bookmarks", {
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.total).toBe(1);
    const items = data.data as Record<string, unknown>[];
    expect(items).toHaveLength(1);

    const item = items[0]!;
    expect(item.id).toBe(messageIds[0]);
    expect(item.content).toBe("Bookmark test message 1");

    // Test 5 — verify fields
    expect(item).toHaveProperty("userId");
    expect(item.userId).toBe(userId);
    expect(item).toHaveProperty("avatarUrl");
    expect(item).toHaveProperty("signature");
    // Signature is visible because currentUser owns the bookmarked message
    expect(item.signature).toBe("My bookmark test signature");
    // likeCount should exist and be a number
    expect(item).toHaveProperty("likeCount");
    expect(typeof item.likeCount).toBe("number");
  });

  // ── Bookmark 2nd & 3rd messages ──────────────────────────────────

  it("bookmarks the remaining 2 messages", async () => {

    for (let i = 1; i <= 2; i++) {
      const req = new Request(`http://localhost/api/messages/${messageIds[i]}/bookmark`, {
        method: "POST",
        headers: { Cookie: cookie! },
      });
      const res = await app.handle(req);
      const data = await res.json() as Json;
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.bookmarked).toBe(true);
    }
  });

  // ── Test 4: pagination offset=0, limit=1 ──────────────────────────

  it("returns paginated bookmarks with offset=0, limit=1", async () => {

    const req = new Request("http://localhost/api/bookmarks?offset=0&limit=1", {
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const items = data.data as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(data.total).toBe(3);
    expect(data.offset).toBe(0);
    expect(data.limit).toBe(1);
    // Most recently bookmarked is message 3
    expect(items[0]!.id).toBe(messageIds[2]);
  });

  // ── Test 6: ordered by bookmark time (most recent first) ──────────

  it("returns bookmarks ordered by bookmark time (most recent first)", async () => {

    const req = new Request("http://localhost/api/bookmarks", {
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const items = data.data as Record<string, unknown>[];
    expect(items).toHaveLength(3);
    // Bookmark order: message 1 → message 2 → message 3
    // GET /bookmarks orders by DESC bookmark created_at, so: 3, 2, 1
    expect(items[0]!.id).toBe(messageIds[2]);
    expect(items[1]!.id).toBe(messageIds[1]);
    expect(items[2]!.id).toBe(messageIds[0]);
  });

  // ── Test 7: soft-delete removes from bookmark list ────────────────

  it("removes bookmarked message after soft-delete", async () => {


    // Soft-delete message 2
    const delReq = new Request(`http://localhost/api/message/${messageIds[1]}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({ deleted: 1 }),
    });
    const delRes = await app.handle(delReq);
    const delData = await delRes.json() as Json;
    expect(delRes.status).toBe(200);
    expect(delData.success).toBe(true);

    // GET /bookmarks should now have 2 items (message 2 vanished)
    const req = new Request("http://localhost/api/bookmarks", {
      headers: { Cookie: cookie! },
    });
    const res = await app.handle(req);
    const data = await res.json() as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.total).toBe(2);
    const items = data.data as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    // Remaining: message 3 and message 1 (most recent first)
    expect(items[0]!.id).toBe(messageIds[2]);
    expect(items[1]!.id).toBe(messageIds[0]);
  });
});
