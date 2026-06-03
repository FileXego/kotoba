import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupApp, getApp, cleanup, extractCookie } from "../helpers";

type Json = Record<string, unknown>;

describe("Messages", () => {
  let cookie1: string | null = null;
  let cookie2: string | null = null;
  let rootMsgId = 0;
  let reply1Id = 0; // depth=1
  let reply2Id = 0; // depth=2
  let deletedMsgId = 0;
  let keywordMsgId = 0;

  beforeAll(async () => {
    await setupApp();
    const app = getApp();

    // Sign up user1
    const r1 = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "msgu1",
          email: "msgu1@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      }),
    );
    cookie1 = extractCookie(r1);
    if (!cookie1) throw new Error("Failed to extract cookie for user1");

    // Sign up user2
    const r2 = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "msgu2",
          email: "msgu2@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      }),
    );
    cookie2 = extractCookie(r2);
    if (!cookie2) throw new Error("Failed to extract cookie for user2");
  });

  afterAll(() => {
    cleanup();
  });

  // ── GET /api/messages (empty) ───────────────────────────────────────

  // Test 9 — may have data from other test files (shared DB), just verify response shape
  it("GET /api/messages → 200, valid response shape", async () => {
    const app = getApp();
    const res = await app.handle(new Request("http://localhost/api/messages"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  // ── POST /api/message ───────────────────────────────────────────────

  // Test 1
  it("POST /api/message without auth → 401 AUTH_REQUIRED", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "test" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("AUTH_REQUIRED");
  });

  // Test 2
  it("POST /api/message with auth → 200, returns { success: true, id: number }", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "Root message from user1" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.id).toBe("number");
    rootMsgId = data.id as number;
    expect(rootMsgId).toBeGreaterThan(0);
  });

  // Test 3
  it("POST /api/message with empty content → 422 VALIDATION", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error).toBe("VALIDATION");
  });

  // Test 4
  it("POST /api/message with content > 500 chars → 422 VALIDATION", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "x".repeat(501) }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error).toBe("VALIDATION");
  });

  // Test 5
  it("POST /api/message reply to non-existent parent → 400 PARENT_NOT_FOUND", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "reply to nowhere", parentId: 99999 }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("PARENT_NOT_FOUND");
  });

  // Test 6
  it("POST /api/message reply to existing message → 200, check depth=1", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "Reply at depth 1", parentId: rootMsgId }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    reply1Id = data.id as number;
    expect(reply1Id).toBeGreaterThan(0);

    // Verify depth=1 via replies endpoint
    const rres = await app.handle(new Request(`http://localhost/api/messages/${rootMsgId}/replies`));
    const rdata = (await rres.json()) as Json;
    const replies = (rdata.data ?? []) as Array<Record<string, unknown>>;
    const found = replies.find((r) => r.id === reply1Id);
    expect(found).toBeDefined();
    expect(found!.depth).toBe(1);
  });

  // Test 7
  it("POST /api/message reply at depth=2 (reply to a reply) → 200", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "Reply at depth 2", parentId: reply1Id }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    reply2Id = data.id as number;
    expect(reply2Id).toBeGreaterThan(0);

    // Verify depth=2 via replies endpoint
    const rres = await app.handle(new Request(`http://localhost/api/messages/${rootMsgId}/replies`));
    const rdata = (await rres.json()) as Json;
    const replies = (rdata.data ?? []) as Array<Record<string, unknown>>;
    const found = replies.find((r) => r.id === reply2Id);
    expect(found).toBeDefined();
    expect(found!.depth).toBe(2);
  });

  // Test 8
  it("POST /api/message reply at depth=3 (reply to depth=2) → 409 MAX_DEPTH", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "Should fail at depth 3", parentId: reply2Id }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe("MAX_DEPTH");
  });

  // ── GET /api/messages (after posting) ───────────────────────────────

  // Test 10
  it("GET /api/messages after posting → 200, data contains posted message", async () => {
    const app = getApp();
    const res = await app.handle(new Request("http://localhost/api/messages"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect((data.data as Array<unknown>).length).toBeGreaterThanOrEqual(1);
    expect((data.total as number)).toBeGreaterThanOrEqual(1);
    const ids = (data.data as Array<Record<string, unknown>>).map((r) => r.id);
    expect(ids).toContain(rootMsgId);
  });

  // Test 11
  it("GET /api/messages with pagination → offset=0&limit=1 returns 1 message, total correct", async () => {
    const app = getApp();
    const res = await app.handle(new Request("http://localhost/api/messages?offset=0&limit=1"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect((data.data as Array<unknown>).length).toBe(1);
    expect((data.total as number)).toBeGreaterThanOrEqual(1);
    expect(data.offset).toBe(0);
    expect(data.limit).toBe(1);
  });

  // Test 12
  it("GET /api/messages with search → q=keyword finds message with that content", async () => {
    const app = getApp();

    // Create a message with a distinctive keyword
    const createRes = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "This message contains special_keyword_xyzzy for search testing" }),
      }),
    );
    const createData = (await createRes.json()) as Json;
    keywordMsgId = createData.id as number;
    expect(keywordMsgId).toBeGreaterThan(0);

    // Search for that keyword
    const res = await app.handle(new Request("http://localhost/api/messages?q=special_keyword_xyzzy"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect((data.data as Array<unknown>).length).toBeGreaterThanOrEqual(1);
    const ids = (data.data as Array<Record<string, unknown>>).map((r) => r.id);
    expect(ids).toContain(keywordMsgId);
  });

  // Test 13
  it("GET /api/messages with search — no match → 200, empty data", async () => {
    const app = getApp();
    const res = await app.handle(new Request("http://localhost/api/messages?q=zzz_nonexistent_string_yyy"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
    expect(data.total).toBe(0);
  });

  // ── GET /api/messages/:id/replies ───────────────────────────────────

  // Test 14 — 99999 is a valid number (not NaN), so it won't trigger INVALID_ID
  it("GET /api/messages/99999/replies → 200, empty data", async () => {
    const app = getApp();
    const res = await app.handle(new Request("http://localhost/api/messages/99999/replies"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  // Test 15 — replies endpoint returns the message itself (root_id = id OR id = id),
  // so a "no replies" message returns itself in the data array
  it("GET /api/messages/:id/replies (no replies) → 200, data contains the message itself", async () => {
    const app = getApp();

    // Create a message and don't add any replies
    const createRes = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie2! },
        body: JSON.stringify({ content: "Lonely message with no replies" }),
      }),
    );
    const createData = (await createRes.json()) as Json;
    const lonelyMsgId = createData.id as number;

    const res = await app.handle(new Request(`http://localhost/api/messages/${lonelyMsgId}/replies`));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect((data.data as Array<unknown>).length).toBe(1);
    expect((data.data as Array<Record<string, unknown>>)[0]!.id).toBe(lonelyMsgId);
  });

  // Test 16
  it("GET /api/messages/:id/replies (with replies) → 200, data contains replies in correct order", async () => {
    const app = getApp();
    const res = await app.handle(new Request(`http://localhost/api/messages/${rootMsgId}/replies`));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect((data.data as Array<unknown>).length).toBeGreaterThanOrEqual(2);

    const replies = data.data as Array<Record<string, unknown>>;
    const ids = replies.map((r) => r.id);
    expect(ids).toContain(reply1Id);
    expect(ids).toContain(reply2Id);

    // Verify ascending order by createdAt
    for (let i = 1; i < replies.length; i++) {
      const prev = new Date(replies[i - 1]!.createdAt as string).getTime();
      const curr = new Date(replies[i]!.createdAt as string).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  // ── PATCH /api/message/:id ──────────────────────────────────────────

  // Test 17 — PATCH has no explicit 401 check; it returns 403 FORBIDDEN
  // when no valid author (including unauthenticated users)
  it("PATCH /api/message/:id without auth → 403 FORBIDDEN", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/message/${rootMsgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "edited without auth" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });

  // Test 18
  it("PATCH /api/message/:id edit own message → 200, content updated", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/message/${rootMsgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "Updated content by user1" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  // Test 19
  it("PATCH /api/message/:id edit other user's message → 403 FORBIDDEN", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/message/${rootMsgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie2! },
        body: JSON.stringify({ content: "trying to edit someone else's message" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });

  // Test 20
  it("PATCH /api/message/:id non-existent message → 404 NOT_FOUND", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/message/99999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "edit non-existent" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("NOT_FOUND");
  });

  // Test 21
  it("PATCH /api/message/:id with empty content → 422 VALIDATION", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/message/${rootMsgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "" }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error).toBe("VALIDATION");
  });

  // Test 22
  it("PATCH /api/message/:id soft-delete own message → 200, message vanishes from GET", async () => {
    const app = getApp();

    // Create a fresh message to soft-delete
    const createRes = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ content: "This message will be deleted" }),
      }),
    );
    const createData = (await createRes.json()) as Json;
    const delId = createData.id as number;
    deletedMsgId = delId;

    // Soft-delete it
    const res = await app.handle(
      new Request(`http://localhost/api/message/${delId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ deleted: 1 }),
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify it vanished from GET /api/messages
    const getRes = await app.handle(new Request("http://localhost/api/messages"));
    const getData = (await getRes.json()) as Json;
    const ids = (getData.data as Array<Record<string, unknown>>).map((r) => r.id);
    expect(ids).not.toContain(delId);
  });

  // ── POST /api/messages/:id/like ─────────────────────────────────────

  // Test 23
  it("POST /api/messages/:id/like without auth → 401 AUTH_REQUIRED", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/like`, { method: "POST" }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("AUTH_REQUIRED");
  });

  // Test 24
  it("POST /api/messages/:id/like → 200, liked: true, count: 1", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/like`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.liked).toBe(true);
    expect(data.count).toBe(1);
  });

  // Test 25
  it("POST /api/messages/:id/like again (toggle off) → 200, liked: false, count: 0", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/like`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.liked).toBe(false);
    expect(data.count).toBe(0);
  });

  // Test 26
  it("POST /api/messages/99999/like (non-existent) → 404 NOT_FOUND", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/messages/99999/like", {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("NOT_FOUND");
  });

  // Test 27
  it("POST /api/messages/:id/like on deleted message → 404 NOT_FOUND", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${deletedMsgId}/like`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("NOT_FOUND");
  });

  // ── POST /api/messages/:id/bookmark ─────────────────────────────────

  // Test 28
  it("POST /api/messages/:id/bookmark without auth → 401 AUTH_REQUIRED", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/bookmark`, { method: "POST" }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("AUTH_REQUIRED");
  });

  // Test 29
  it("POST /api/messages/:id/bookmark → 200, bookmarked: true", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/bookmark`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bookmarked).toBe(true);
  });

  // Test 30
  it("POST /api/messages/:id/bookmark again (toggle off) → 200, bookmarked: false", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/bookmark`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bookmarked).toBe(false);
  });

  // Test 31
  it("POST /api/messages/99999/bookmark (non-existent) → 404 NOT_FOUND", async () => {
    const app = getApp();
    const res = await app.handle(
      new Request("http://localhost/api/messages/99999/bookmark", {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("NOT_FOUND");
  });

  // ── GET /api/me/likes ───────────────────────────────────────────────

  // Test 32
  it("GET /api/me/likes without auth → 200, liked: [], bookmarked: []", async () => {
    const app = getApp();
    const res = await app.handle(new Request("http://localhost/api/me/likes"));
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.liked).toEqual([]);
    expect(data.bookmarked).toEqual([]);
  });

  // Test 33
  it("GET /api/me/likes after liking + bookmarking → 200, liked: [id], bookmarked: [id]", async () => {
    const app = getApp();

    // Like and bookmark rootMsgId (previous tests toggled them off)
    await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/like`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );
    await app.handle(
      new Request(`http://localhost/api/messages/${rootMsgId}/bookmark`, {
        method: "POST",
        headers: { Cookie: cookie1! },
      }),
    );

    const res = await app.handle(
      new Request("http://localhost/api/me/likes", {
        headers: { Cookie: cookie1! },
      }),
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.liked)).toBe(true);
    expect(Array.isArray(data.bookmarked)).toBe(true);
    expect(data.liked).toContain(rootMsgId);
    expect(data.bookmarked).toContain(rootMsgId);
  });
});
