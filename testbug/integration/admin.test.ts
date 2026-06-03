import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupApp, extractCookie } from "../helpers";
import { Database } from "bun:sqlite";

type Json = Record<string, unknown>;

describe("Admin", () => {
  let app: ReturnType<typeof import("../src/app").createApp>;
  let cleanup: () => void;
  let adminCookie: string | null = null;
  let regularCookie: string | null = null;
  let adminId: number;
  let regularUserId: number;
  let msg1Id: number;
  let msg2Id: number;

  beforeAll(async () => {
    const result = await setupApp();
    app = result.app;
    cleanup = result.cleanup;

    // ── 1. Sign up admin user ──────────────────────────────────────
    const adminSignupRes = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "adminuser",
          email: "admin@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      }),
    );
    const adminSignupData = (await adminSignupRes.json()) as Json;
    adminCookie = extractCookie(adminSignupRes);
    expect(adminCookie).not.toBeNull();
    adminId = ((adminSignupData.user as Json).id as number);

    // ── 2. Manually promote to admin via direct DB ─────────────────
    const sqlite = new Database(process.env.TEST_DB!);
    sqlite.exec(`UPDATE users SET is_admin = 1 WHERE username = 'adminuser'`);
    sqlite.close();

    // ── 3. Sign up regular user ────────────────────────────────────
    const regSignupRes = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "regularuser",
          email: "regular@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      }),
    );
    const regSignupData = (await regSignupRes.json()) as Json;
    regularCookie = extractCookie(regSignupRes);
    expect(regularCookie).not.toBeNull();
    regularUserId = ((regSignupData.user as Json).id as number);

    // ── 4. Post two messages as the regular user ───────────────────
    const msg1Res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: regularCookie! },
        body: JSON.stringify({ content: "First test message" }),
      }),
    );
    msg1Id = ((await msg1Res.json()) as Json).id as number;

    const msg2Res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: regularCookie! },
        body: JSON.stringify({ content: "Second test message (to be deleted)" }),
      }),
    );
    msg2Id = ((await msg2Res.json()) as Json).id as number;

    // ── 5. Soft-delete msg2 as admin ───────────────────────────────
    await app.handle(
      new Request(`http://localhost/api/message/${msg2Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie! },
        body: JSON.stringify({ deleted: 1 }),
      }),
    );
  });

  afterAll(() => {
    cleanup();
  });

  // ────────────────────────────────────────────────────────────────
  //  GET /admin/messages
  // ────────────────────────────────────────────────────────────────

  it("returns 403 for GET /admin/messages without auth", async () => {

    const res = await app.handle(new Request("http://localhost/api/admin/messages"));
    expect(res.status).toBe(403);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });

  it("returns 403 for GET /admin/messages as regular user (not admin)", async () => {

    const res = await app.handle(
      new Request("http://localhost/api/admin/messages", {
        headers: { Cookie: regularCookie! },
      }),
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });

  it("returns 200 with data array for GET /admin/messages as admin", async () => {

    const res = await app.handle(
      new Request("http://localhost/api/admin/messages", {
        headers: { Cookie: adminCookie! },
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect((data.data as Json[]).length).toBeGreaterThanOrEqual(2);
    expect(typeof data.total).toBe("number");
  });

  it("GET /admin/messages includes soft-deleted messages", async () => {

    const res = await app.handle(
      new Request("http://localhost/api/admin/messages", {
        headers: { Cookie: adminCookie! },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    const msgs = body.data as Json[];
    const deletedMsg = msgs.find((m) => m.id === msg2Id);
    expect(deletedMsg).toBeDefined();
    expect(deletedMsg!.content as string).toBe("Second test message (to be deleted)");
  });

  // ────────────────────────────────────────────────────────────────
  //  PATCH /admin/messages/:id/restore
  // ────────────────────────────────────────────────────────────────

  it("restores a soft-deleted message via PATCH /admin/messages/:id/restore", async () => {

    const res = await app.handle(
      new Request(`http://localhost/api/admin/messages/${msg2Id}/restore`, {
        method: "PATCH",
        headers: { Cookie: adminCookie! },
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(true);
  });

  it("returns 404 for PATCH /admin/messages/:id/restore with non-existent id", async () => {

    const res = await app.handle(
      new Request("http://localhost/api/admin/messages/999999/restore", {
        method: "PATCH",
        headers: { Cookie: adminCookie! },
      }),
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(false);
    expect(data.error).toBe("NOT_FOUND");
  });

  // ────────────────────────────────────────────────────────────────
  //  GET /admin/users
  // ────────────────────────────────────────────────────────────────

  it("returns 200 with users array for GET /admin/users as admin", async () => {

    const res = await app.handle(
      new Request("http://localhost/api/admin/users", {
        headers: { Cookie: adminCookie! },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const userList = body.data as Json[];
    expect(userList.length).toBeGreaterThanOrEqual(2);

    const adminUser = userList.find((u) => u.username === "adminuser");
    expect(adminUser).toBeDefined();
    expect(adminUser!.isAdmin).toBe(1);

    const regUser = userList.find((u) => u.username === "regularuser");
    expect(regUser).toBeDefined();
    expect(regUser!.isAdmin).toBe(0);
  });

  // ────────────────────────────────────────────────────────────────
  //  PATCH /admin/users/:id/admin
  // ────────────────────────────────────────────────────────────────

  it("promotes a regular user to admin via PATCH /admin/users/:id/admin", async () => {

    const res = await app.handle(
      new Request(`http://localhost/api/admin/users/${regularUserId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie! },
        body: JSON.stringify({ admin: true }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(true);

    // Verify the user is now admin
    const checkRes = await app.handle(
      new Request("http://localhost/api/admin/users", {
        headers: { Cookie: adminCookie! },
      }),
    );
    const checkBody = (await checkRes.json()) as Json;
    const updatedUser = (checkBody.data as Json[]).find((u) => u.id === regularUserId);
    expect(updatedUser!.isAdmin).toBe(1);
  });

  it("demotes an admin back to regular user via PATCH /admin/users/:id/admin", async () => {

    const res = await app.handle(
      new Request(`http://localhost/api/admin/users/${regularUserId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie! },
        body: JSON.stringify({ admin: false }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(true);

    // Verify the user is no longer admin
    const checkRes = await app.handle(
      new Request("http://localhost/api/admin/users", {
        headers: { Cookie: adminCookie! },
      }),
    );
    const checkBody = (await checkRes.json()) as Json;
    const updatedUser = (checkBody.data as Json[]).find((u) => u.id === regularUserId);
    expect(updatedUser!.isAdmin).toBe(0);
  });

  it("returns 400 SELF_ADMIN when admin tries to demote themselves", async () => {

    const res = await app.handle(
      new Request(`http://localhost/api/admin/users/${adminId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie! },
        body: JSON.stringify({ admin: false }),
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(false);
    expect(data.error).toBe("SELF_ADMIN");
  });
});
