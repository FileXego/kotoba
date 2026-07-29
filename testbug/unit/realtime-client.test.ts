import { describe, expect, it } from "bun:test";
import * as realtimeClient from "../../client/src/hooks/useRealtimeEvents";

describe("realtime client lifecycle", () => {
  it("keys the EventSource lifecycle to the current authenticated user", async () => {
    const appSource = await Bun.file(new URL("../../client/src/App.tsx", import.meta.url)).text();
    const hookSource = await Bun.file(
      new URL("../../client/src/hooks/useRealtimeEvents.ts", import.meta.url),
    ).text();

    expect(appSource).toContain(
      "useRealtimeEvents(handleRealtimeEvent, user?.id ?? null)",
    );
    expect(hookSource).toMatch(
      /useRealtimeEvents\([\s\S]*authIdentity: number \| null/,
    );
    expect(hookSource).toMatch(
      /\}, \[(?:isSupported,\s*authIdentity|authIdentity,\s*isSupported)\]\);/,
    );
    expect(hookSource).toContain("source.close()");
  });

  it("maps a restored reply to its root thread instead of treating it as a root post", () => {
    const getRealtimeMessageScope = Reflect.get(
      realtimeClient,
      "getRealtimeMessageScope",
    ) as undefined | ((event: unknown) => { rootId: number; touchesTopLevel: boolean } | null);

    expect(typeof getRealtimeMessageScope).toBe("function");
    expect(getRealtimeMessageScope!({
      type: "message.restored",
      messageId: 31,
      parentId: 22,
      rootId: 11,
      updatedAt: "2026-07-29T00:00:00.000Z",
    })).toEqual({ rootId: 11, touchesTopLevel: false });
    expect(getRealtimeMessageScope!({
      type: "message.restored",
      messageId: 11,
      parentId: null,
      rootId: null,
      updatedAt: "2026-07-29T00:00:00.000Z",
    })).toEqual({ rootId: 11, touchesTopLevel: true });
  });
});
