import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { setupApp, extractCookie } from "../helpers";

type Json = Record<string, unknown>;

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function createEventReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";

  const parse = (block: string): SseEvent => {
    const event = block.split("\n").find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
    const data = block.split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    return { event, data: JSON.parse(data) as Record<string, unknown> };
  };

  return {
    async next(timeoutMs = 1000): Promise<SseEvent> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (block.startsWith(":")) continue;
          return parse(block);
        }

        const timeout = Math.max(1, deadline - Date.now());
        const read = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("SSE_TIMEOUT")), timeout);
          }),
        ]);
        if (read.done) throw new Error("SSE_CLOSED");
        buffer += decoder.decode(read.value, { stream: true });
      }
      throw new Error("SSE_TIMEOUT");
    },
  };
}

describe("Realtime events", () => {
  let app: Awaited<ReturnType<typeof import("../../src/app").createApp>>;
  let cleanup: () => void;
  let cookie1: string | null = null;
  let cookie2: string | null = null;

  beforeAll(async () => {
    const result = await setupApp();
    app = result.app;
    cleanup = result.cleanup;

    const r1 = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "realtime1",
          email: "realtime1@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      }),
    );
    cookie1 = extractCookie(r1);

    const r2 = await app.handle(
      new Request("http://localhost/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "realtime2",
          email: "realtime2@test.com",
          password: "123456",
          captchaToken: "test-token",
        }),
      }),
    );
    cookie2 = extractCookie(r2);

    if (!cookie1 || !cookie2) throw new Error("Failed to create realtime test users");
  });

  afterAll(() => {
    cleanup();
  });

  it("streams public message events and private interaction events", async () => {
    const stream1 = await app.handle(new Request("http://localhost/api/events", { headers: { Cookie: cookie1! } }));
    const stream2 = await app.handle(new Request("http://localhost/api/events", { headers: { Cookie: cookie2! } }));
    expect(stream1.status).toBe(200);
    expect(stream2.status).toBe(200);
    expect(stream1.headers.get("Content-Type") ?? "").toContain("text/event-stream");

    const reader1 = stream1.body!.getReader();
    const reader2 = stream2.body!.getReader();
    const events1 = createEventReader(reader1);
    const events2 = createEventReader(reader2);

    try {
      expect((await events1.next()).event).toBe("ready");
      expect((await events2.next()).event).toBe("ready");

      const createRes = await app.handle(
        new Request("http://localhost/api/message", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie1! },
          body: JSON.stringify({ content: "Realtime root" }),
        }),
      );
      const createData = (await createRes.json()) as Json;
      const messageId = createData.id as number;

      const public1 = await events1.next();
      const public2 = await events2.next();
      expect(public1.event).toBe("message.created");
      expect(public2.event).toBe("message.created");
      expect(public1.data.messageId).toBe(messageId);
      expect(public2.data.messageId).toBe(messageId);

      await app.handle(
        new Request(`http://localhost/api/messages/${messageId}/like`, {
          method: "POST",
          headers: { Cookie: cookie1! },
        }),
      );
      expect((await events1.next()).event).toBe("message.liked");
      expect((await events2.next()).event).toBe("message.liked");
      const likedPrivate = await events1.next();
      expect(likedPrivate.event).toBe("interaction.changed");
      expect(likedPrivate.data.liked).toBe(true);

      await app.handle(
        new Request(`http://localhost/api/messages/${messageId}/bookmark`, {
          method: "POST",
          headers: { Cookie: cookie1! },
        }),
      );
      const bookmarkPrivate = await events1.next();
      expect(bookmarkPrivate.event).toBe("interaction.changed");
      expect(bookmarkPrivate.data.bookmarked).toBe(true);
      await expect(events2.next(120)).rejects.toThrow("SSE_TIMEOUT");
    } finally {
      await reader1.cancel();
      await reader2.cancel();
    }
  });

  it("includes the restored reply parent and root so clients refresh the correct thread", async () => {
    const sqlite = new Database(process.env.TEST_DB!);
    sqlite.exec("UPDATE users SET is_admin = 1 WHERE username = 'realtime1'");
    sqlite.close();

    const rootResponse = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie2! },
        body: JSON.stringify({ content: "Restore event root" }),
      }),
    );
    const rootId = ((await rootResponse.json()) as Json).id as number;
    const replyResponse = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie2! },
        body: JSON.stringify({ content: "Restore event reply", parentId: rootId }),
      }),
    );
    const replyId = ((await replyResponse.json()) as Json).id as number;
    const deleteResponse = await app.handle(
      new Request(`http://localhost/api/message/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie1! },
        body: JSON.stringify({ deleted: 1 }),
      }),
    );
    expect(deleteResponse.status).toBe(200);

    const stream = await app.handle(new Request("http://localhost/api/events"));
    const reader = stream.body!.getReader();
    const events = createEventReader(reader);
    try {
      expect((await events.next()).event).toBe("ready");
      const restoreResponse = await app.handle(
        new Request(`http://localhost/api/admin/messages/${replyId}/restore`, {
          method: "PATCH",
          headers: { Cookie: cookie1! },
        }),
      );
      expect(restoreResponse.status).toBe(200);

      const restored = await events.next();
      expect(restored.event).toBe("message.restored");
      expect(restored.data.messageId).toBe(replyId);
      expect(restored.data.parentId).toBe(rootId);
      expect(restored.data.rootId).toBe(rootId);
    } finally {
      await reader.cancel();
    }
  });
});
