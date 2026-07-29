import { describe, expect, it } from "bun:test";
import { resolveClientIp } from "../../src/lib/client-ip";

describe("trusted proxy client IP resolution", () => {
  it("ignores forwarding headers from a non-loopback peer", () => {
    const request = new Request("http://localhost/api/messages", {
      headers: {
        "X-Real-IP": "198.51.100.24",
        "X-Forwarded-For": "198.51.100.24",
      },
    });
    expect(resolveClientIp(request, "203.0.113.9")).toBe("203.0.113.9");
  });

  it("accepts nginx's validated X-Real-IP only from a loopback peer", () => {
    const request = new Request("http://localhost/api/messages", {
      headers: {
        "X-Real-IP": "198.51.100.24",
        "X-Forwarded-For": "192.0.2.1, 192.0.2.2",
      },
    });
    expect(resolveClientIp(request, "127.0.0.1")).toBe("198.51.100.24");
    expect(resolveClientIp(request, "::1")).toBe("198.51.100.24");
  });

  it("rejects malformed proxy values and never trusts X-Forwarded-For directly", () => {
    const malformed = new Request("http://localhost/api/messages", {
      headers: {
        "X-Real-IP": "not-an-ip",
        "X-Forwarded-For": "198.51.100.24",
      },
    });
    expect(resolveClientIp(malformed, "127.0.0.1")).toBe("127.0.0.1");

    const noRealIp = new Request("http://localhost/api/messages", {
      headers: { "X-Forwarded-For": "198.51.100.24" },
    });
    expect(resolveClientIp(noRealIp, "127.0.0.1")).toBe("127.0.0.1");
  });
});
