import { useEffect, useRef, useState } from "react";

export type RealtimeStatus = "connecting" | "live" | "offline" | "unsupported";

export type RealtimeClientEvent =
  | { type: "ready"; serverTs: string }
  | { type: "sync.tick"; reason: "unsupported" | "stale"; serverTs: string }
  | { type: "message.created"; messageId: number; parentId: number | null; rootId: number | null; createdAt: string }
  | { type: "message.updated"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.deleted"; messageId: number; parentId: number | null; rootId: number | null; updatedAt: string }
  | { type: "message.restored"; messageId: number; updatedAt: string }
  | { type: "message.liked"; messageId: number; count: number; updatedAt: string }
  | { type: "interaction.changed"; messageId: number; liked?: boolean; bookmarked?: boolean; count?: number; updatedAt: string };

const EVENT_TYPES: RealtimeClientEvent["type"][] = [
  "ready",
  "message.created",
  "message.updated",
  "message.deleted",
  "message.restored",
  "message.liked",
  "interaction.changed",
];

const FALLBACK_SYNC_MS = 15000;
const STALE_EVENT_MS = 30000;

export function useRealtimeEvents(onEvent: (event: RealtimeClientEvent) => void) {
  const isSupported = "EventSource" in window;
  const [status, setStatus] = useState<RealtimeStatus>(() => isSupported ? "connecting" : "unsupported");
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

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
          if (payload.type === "ready") setStatus("live");
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
  }, [isSupported]);

  return status;
}
