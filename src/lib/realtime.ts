type PublicRealtimeEvent =
  | { type: "message.created"; messageId: number; parentId: number | null; rootId: number | null; createdAt: string }
  | { type: "message.updated"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.deleted"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.restored"; messageId: number; updatedAt: string }
  | { type: "message.liked"; messageId: number; count: number; updatedAt: string };

type PrivateRealtimeEvent = {
  type: "interaction.changed";
  userId: number;
  messageId: number;
  liked?: boolean;
  bookmarked?: boolean;
  count?: number;
  updatedAt: string;
};

export type RealtimeEvent =
  | ({ audience: "public" } & PublicRealtimeEvent)
  | ({ audience: "user" } & PrivateRealtimeEvent);

interface RealtimeClient {
  id: number;
  userId: number | null;
  controller: ReadableStreamDefaultController<Uint8Array>;
  heartbeat: ReturnType<typeof setInterval>;
}

const encoder = new TextEncoder();
const clients = new Map<number, RealtimeClient>();
let nextClientId = 1;
let nextEventId = 1;

function stripAudience(event: RealtimeEvent) {
  const { audience: _, ...payload } = event;
  if ("userId" in payload) {
    const { userId: __, ...safePayload } = payload;
    return safePayload;
  }
  return payload;
}

function encodeSse(eventName: string, data: unknown) {
  return encoder.encode([
    `id: ${nextEventId++}`,
    `event: ${eventName}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ].join("\n"));
}

function enqueue(client: RealtimeClient, chunk: Uint8Array) {
  try {
    client.controller.enqueue(chunk);
  } catch {
    closeRealtimeClient(client.id);
  }
}

function closeRealtimeClient(clientId: number) {
  const client = clients.get(clientId);
  if (!client) return;
  clearInterval(client.heartbeat);
  clients.delete(clientId);
}

export function createRealtimeStream(userId: number | null, signal?: AbortSignal) {
  let clientId = 0;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      clientId = nextClientId++;
      const client: RealtimeClient = {
        id: clientId,
        userId,
        controller,
        heartbeat: setInterval(() => enqueue(client, encoder.encode(": keep-alive\n\n")), 25000),
      };
      client.heartbeat.unref?.();
      clients.set(clientId, client);
      enqueue(client, encodeSse("ready", { type: "ready", serverTs: new Date().toISOString() }));
      signal?.addEventListener("abort", () => closeRealtimeClient(clientId), { once: true });
    },
    cancel() {
      closeRealtimeClient(clientId);
    },
  });
}

export function publishRealtime(event: RealtimeEvent) {
  const chunk = encodeSse(event.type, stripAudience(event));
  for (const client of clients.values()) {
    if (event.audience === "public" || client.userId === event.userId) {
      enqueue(client, chunk);
    }
  }
}

