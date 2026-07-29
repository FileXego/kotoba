import { describe, expect, it } from "bun:test";
import { createApp } from "../../src/app";
import { APP_VERSION } from "../../src/lib/release-info";

type Json = Record<string, unknown>;

describe("readiness health endpoint", () => {
  it("reports the canonical package version and release revision when ready", async () => {
    const app = await createApp({
      staticMode: false,
      readinessCheck: async () => {},
      revision: "0123456789abcdef0123456789abcdef01234567",
    });
    const res = await app.handle(new Request("http://localhost/api/health"));
    const data = await res.json() as Json;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("ready");
    expect(data.version).toBe(APP_VERSION);
    expect(data.version).toBe("2.1.2");
    expect(data.revision).toBe("0123456789abcdef0123456789abcdef01234567");
  });

  it("returns an opaque 503 when a readiness dependency fails", async () => {
    const app = await createApp({
      staticMode: true,
      readinessCheck: async () => {
        throw new Error("synthetic database detail");
      },
      revision: "test-revision",
    });
    const res = await app.handle(new Request("http://localhost/api/health"));
    const data = await res.json() as Json;

    expect(res.status).toBe(503);
    expect(data).toEqual({ success: false, error: "NOT_READY" });
    expect(JSON.stringify(data)).not.toContain("synthetic");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
