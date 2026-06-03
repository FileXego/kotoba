import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupApp, getApp, cleanup, extractCookie } from "../helpers";
import { resolve } from "node:path";

type Json = Record<string, unknown>;

/** Minimal 1×1 transparent PNG as Uint8Array. */
function testPngBlob(): Blob {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

describe("Upload", () => {
  let cookie: string | null = null;

  beforeAll(async () => {
    await setupApp();
    const app = getApp();

    // Sign up a user for authenticated tests
    const signUpRes = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "uploadtest",
          email: "uploadtest@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      })
    );
    expect(signUpRes.status).toBe(200);

    // Sign in to obtain session cookie
    const signInRes = await app.handle(
      new Request("http://localhost/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "uploadtest", password: "123456" }),
      })
    );
    expect(signInRes.status).toBe(200);
    cookie = extractCookie(signInRes);
    expect(cookie).not.toBeNull();
  });

  afterAll(() => {
    cleanup();
  });

  // ── No auth ──────────────────────────────────────────────────────

  it("POST /upload without auth returns 401", async () => {
    const app = getApp();
    const fd = new FormData();
    fd.append("file", testPngBlob(), "test.png");

    const res = await app.handle(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(401);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(false);
    expect(data.error).toBe("AUTH_REQUIRED");
  });

  // ── Valid image upload + file on disk ──────────────────────────

  it("POST /upload with valid PNG image returns 200, url, and writes file to disk", async () => {
    const app = getApp();
    const fd = new FormData();
    fd.append("file", testPngBlob(), "test.png");

    const res = await app.handle(
      new Request("http://localhost/api/upload", {
        method: "POST",
        headers: { Cookie: cookie! },
        body: fd,
      })
    );
    const data = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.url).toMatch(/^\/uploads\/.+\.png$/);

    // Verify the file exists on disk
    const url = data.url as string; // e.g. "/uploads/1685000000-abc12345.png"
    const filename = url.replace("/uploads/", "");
    const filePath = resolve("uploads", filename);
    const uploadedFile = Bun.file(filePath);
    expect(await uploadedFile.exists()).toBe(true);
  });

  // ── Non-image file rejected ─────────────────────────────────────

  it("POST /upload with non-image file fails validation", async () => {
    const app = getApp();
    const txtBlob = new Blob(["hello world"], { type: "text/plain" });
    const fd = new FormData();
    fd.append("file", txtBlob, "test.txt");

    const res = await app.handle(
      new Request("http://localhost/api/upload", {
        method: "POST",
        headers: { Cookie: cookie! },
        body: fd,
      })
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as Json;
    expect(data.success).toBe(false);
    expect(data.error).toBe("INVALID_FILE_TYPE");
  });
});
