import { Elysia } from "elysia";

// in-memory rate limiter: IP → { count, resetAt }
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkIP(ip: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (bucket.count >= maxPerMinute) return false;
  bucket.count++;
  return true;
}

export const rateLimiter = new Elysia()
  .onRequest(({ request, set, status }) => {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const url = new URL(request.url);

    // only limit high-risk endpoints
    if (url.pathname.includes("/sign-up")) {
      if (!checkIP(ip, 3)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname.includes("/upload")) {
      if (!checkIP(ip, 5)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
  });
