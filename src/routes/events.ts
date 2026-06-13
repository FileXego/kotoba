import { Elysia } from "elysia";
import { createRealtimeStream } from "../lib/realtime";

export const eventRoute = new Elysia({ prefix: "/api" })
  .get("/events", ({ currentUser, request }) =>
    new Response(createRealtimeStream(currentUser?.id ?? null, request.signal), {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  );

