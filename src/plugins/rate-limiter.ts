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

const BOT_UAS = ["curl", "wget", "python-requests", "python-urllib", "Go-http-client", "Java/", "libwww", "scrapy", "axios/", "node-fetch", "okhttp"];

function isBotUA(ua: string | null): boolean {
  if (!ua) return true;
  const lower = ua.toLowerCase();
  return BOT_UAS.some(bot => lower.includes(bot.toLowerCase()));
}

export const rateLimiter = new Elysia()
  .onRequest(({ request, set, status }) => {
    // skip rate limiting in test mode only (never in production)
    if (process.env.SKIP_RATE_LIMIT === "1") {
      if (import.meta.env.NODE_ENV === "production") {
        console.error("SKIP_RATE_LIMIT is not allowed in production");
        process.exit(1);
      }
      return;
    }
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent");

    // Bot UA detection — block known scraper agents on read endpoints
    if (isBotUA(ua)) {
      if (url.pathname === "/api/messages" || url.pathname === "/api/bookmarks") {
        return status(403, { success: false, error: "FORBIDDEN" });
      }
    }

    // Rate-limited endpoints
    if (url.pathname === "/api/auth/sign-up") {
      if (!checkIP(ip, 3)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname === "/api/auth/sign-in") {
      if (!checkIP(ip, 10)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname === "/api/upload") {
      if (!checkIP(ip, 5)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname === "/api/messages") {
      if (!checkIP(ip, 60)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
  });
