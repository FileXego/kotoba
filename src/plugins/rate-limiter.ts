import { Elysia } from "elysia";

// in-memory rate limiter: scope:IP → { count, resetAt }
const buckets = new Map<string, { count: number; resetAt: number }>();
const isProd = import.meta.env.NODE_ENV === "production";
let lastCleanup = 0;

function checkRate(scope: string, ip: string, maxPerMinute: number): boolean {
  const now = Date.now();
  cleanupBuckets(now);
  const key = `${scope}:${ip}`;
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60000 });
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

function cleanupBuckets(now: number) {
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "127.0.0.1";
}

function hasCookie(request: Request, name: string, value: string) {
  return request.headers.get("cookie")
    ?.split(";")
    .some((part) => part.trim() === `${name}=${value}`) ?? false;
}

// ── Burst rate limit ──
const requestTimes = new Map<string, number[]>();
const BURST_MAX = 100;
const BURST_WINDOW = 10000; // 10 seconds

function isBursting(ip: string): boolean {
  const now = Date.now();
  const times = requestTimes.get(ip) ?? [];
  const recent = times.filter(t => now - t < BURST_WINDOW);
  recent.push(now);
  requestTimes.set(ip, recent);
  return recent.length > BURST_MAX;
}

// Clean up burst tracking every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of requestTimes) {
    const filtered = times.filter(t => now - t < BURST_WINDOW);
    if (filtered.length === 0) requestTimes.delete(ip);
    else requestTimes.set(ip, filtered);
  }
}, 60000);

export const rateLimiter = new Elysia()
  .onRequest(({ request, set, status }) => {
    // skip rate limiting in test mode only (never in production)
    if (process.env.SKIP_RATE_LIMIT === "1") {
      if (isProd) {
        console.error("SKIP_RATE_LIMIT is not allowed in production");
        process.exit(1);
      }
      return;
    }
    const ip = clientIp(request);
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent");
    const readPath = url.pathname === "/api/messages" || url.pathname === "/api/bookmarks";

    // Burst check — per-IP request flood protection
    if (isBursting(ip)) return status(429, { success: false, error: "TOO_MANY_REQUESTS" });

    if (isProd && readPath && !hasCookie(request, "_kb", "1")) {
      return status(403, { success: false, error: "FORBIDDEN" });
    }

    // Bot UA detection — block known scraper agents on read endpoints
    if (isBotUA(ua)) {
      if (readPath) {
        return status(403, { success: false, error: "FORBIDDEN" });
      }
    }

    // Rate-limited endpoints
    if (url.pathname === "/api/auth/sign-up") {
      if (!checkRate("sign-up", ip, 3)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname === "/api/auth/sign-in") {
      if (!checkRate("sign-in", ip, 10)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname === "/api/upload") {
      if (!checkRate("upload", ip, 5)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
    if (url.pathname === "/api/messages") {
      if (!checkRate("messages", ip, 60)) return status(429, { success: false, error: "RATE_LIMITED" });
    }
  });
