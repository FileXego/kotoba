import { useEffect, useRef, useState } from "react";

export type RealtimeStatus = "connecting" | "live" | "offline" | "unsupported";

export type RealtimeClientEvent =
  | { type: "ready"; serverTs: string }
  | { type: "sync.tick"; reason: "unsupported" | "stale"; serverTs: string }
  | { type: "message.created"; messageId: number; parentId: number | null; rootId: number | null; createdAt: string }
  | { type: "message.updated"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.deleted"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.restored"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.liked"; messageId: number; count: number; updatedAt: string }
  | { type: "interaction.changed"; messageId: number; liked?: boolean; bookmarked?: boolean; count?: number; updatedAt: string }
  | { type: "ping"; ts: number };

const EVENT_TYPES: RealtimeClientEvent["type"][] = [
  "ready",
  "message.created",
  "message.updated",
  "message.deleted",
  "message.restored",
  "message.liked",
  "interaction.changed",
  "ping",
];

const FALLBACK_SYNC_MS = 15000;
const STALE_EVENT_MS = 30000;

export function getRealtimeMessageScope(event: RealtimeClientEvent) {
  if (
    event.type !== "message.created"
    && event.type !== "message.updated"
    && event.type !== "message.deleted"
    && event.type !== "message.restored"
  ) {
    return null;
  }
  return {
    rootId: event.rootId ?? event.messageId,
    touchesTopLevel: event.parentId === null,
  };
}

export function useRealtimeEvents(
  onEvent: (event: RealtimeClientEvent) => void,
  authIdentity: number | null,
) {
  const isSupported = "EventSource" in window;
  const [status, setStatus] = useState<RealtimeStatus>(() => isSupported ? "connecting" : "unsupported");
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const hasBeenLive = useRef(false);

  useEffect(() => {
    if (!isSupported) {
      const fallback = setInterval(() => {
        onEventRef.current({ type: "sync.tick", reason: "unsupported", serverTs: new Date().toISOString() });
      }, FALLBACK_SYNC_MS);
      return () => clearInterval(fallback);
    }

    const source = new EventSource("/api/events");
    let lastEventAt = Date.now();
    const fallback = setInterval(() => {
      if (Date.now() - lastEventAt > STALE_EVENT_MS) {
        onEventRef.current({ type: "sync.tick", reason: "stale", serverTs: new Date().toISOString() });
      }
    }, FALLBACK_SYNC_MS);
    const listeners = EVENT_TYPES.map((type) => {
      const listener = (event: MessageEvent<string>) => {
        try {
          lastEventAt = Date.now();
          const payload = JSON.parse(event.data) as RealtimeClientEvent;
          if (payload.type === "ready") {
            if (hasBeenLive.current) {
              // reconnect after gap → full resync
              setStatus("live");
              onEventRef.current({ type: "sync.tick", reason: "stale", serverTs: payload.serverTs });
              return;
            }
            hasBeenLive.current = true;
          }
          onEventRef.current(payload);
        } catch {
          setStatus("offline");
        }
      };
      source.addEventListener(type, listener);
      return [type, listener] as const;
    });

    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus("offline");

    return () => {
      clearInterval(fallback);
      for (const [type, listener] of listeners) source.removeEventListener(type, listener);
      source.close();
    };
  }, [isSupported, authIdentity]);

  return status;
}
