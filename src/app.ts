import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { bookmarkRoute } from "./routes/bookmark";
import { eventRoute } from "./routes/events";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { admin } from "./plugins/admin";
import { assetDir, clientIndexPath, serveLocalFile, uploadDir } from "./lib/files";
import { loadBannedWords } from "./lib/banned";
import { assertApplicationReady } from "./lib/readiness";
import { APP_VERSION, readReleaseRevision } from "./lib/release-info";

export interface AppOptions {
  staticMode?: boolean;
  readinessCheck?: (staticMode: boolean) => Promise<void>;
  revision?: string;
}

const UPLOAD_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);
const ASSET_EXTS = new Set(["css", "js", "map", "png", "jpg", "jpeg", "webp", "svg", "ico", "woff", "woff2"]);
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self'",
].join("; ");

export async function createApp(options: AppOptions = {}) {
  await loadBannedWords();
  const staticMode = options.staticMode ?? false;
  const readinessCheck = options.readinessCheck ?? assertApplicationReady;
  const revision = options.revision ?? readReleaseRevision();
  const app = new Elysia()
    .onRequest(({ set }) => {
      set.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY;
      set.headers["X-Content-Type-Options"] = "nosniff";
      set.headers["X-Frame-Options"] = "DENY";
      set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
      set.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    })
    .onError(({ code, status, error }) => {
      if (code === "VALIDATION") return status(422, { success: false, error: "VALIDATION" });
      if (code === "NOT_FOUND") return status(404, { success: false, error: "NOT_FOUND" });
      console.error("Unhandled request error:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      return status(500, { success: false, error: "INTERNAL_ERROR" });
    })
    .use(rateLimiter)
    .use(auth)
    .use(admin)
    .use(eventRoute)
    .use(messageRoute)
    .use(bookmarkRoute)
    .use(uploadRoute)
    .get("/api/health", async ({ status }) => {
      try {
        await readinessCheck(staticMode);
        return { success: true, status: "ready", version: APP_VERSION, revision };
      } catch (error) {
        console.error("Readiness check failed:", error instanceof Error ? error.message : String(error));
        return status(503, { success: false, error: "NOT_READY" });
      }
    })
    .get("/uploads/*", async ({ request, status }) =>
      serveLocalFile(request, status, "/uploads/", uploadDir, UPLOAD_EXTS)
    );

  if (!staticMode) {
    return app.get("/", () => "ElysiaJS is running!");
  }

  return app
    .get("/assets/*", async ({ request, status }) =>
      serveLocalFile(request, status, "/assets/", assetDir, ASSET_EXTS)
    )
    .get("/api/*", ({ status }) => status(404, { success: false, error: "NOT_FOUND" }))
    .get("*", () => Bun.file(clientIndexPath));
}
