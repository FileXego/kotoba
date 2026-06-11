import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { bookmarkRoute } from "./routes/bookmark";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { admin } from "./plugins/admin";
import { assetDir, clientIndexPath, serveLocalFile, uploadDir } from "./lib/files";
import { loadBannedWords } from "./lib/banned";

export interface AppOptions {
  staticMode?: boolean;
}

const UPLOAD_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);
const ASSET_EXTS = new Set(["css", "js", "map", "png", "jpg", "jpeg", "webp", "svg", "ico", "woff", "woff2"]);

export async function createApp(options: AppOptions = {}) {
  await loadBannedWords();
  const app = new Elysia({
    sanitize: (value) => (typeof value === "string" ? Bun.escapeHTML(value) : value),
  })
    .state("csp", "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-src https://challenges.cloudflare.com; connect-src 'self'")
    .onAfterHandle(({ set, store: { csp } }) => {
      set.headers["Content-Security-Policy"] = csp;
      set.headers["X-Content-Type-Options"] = "nosniff";
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
    .use(messageRoute)
    .use(bookmarkRoute)
    .use(uploadRoute)
    .get("/api/health", () => ({ success: true, version: "2.1.0" }))
    .get("/uploads/*", async ({ request, status }) =>
      serveLocalFile(request, status, "/uploads/", uploadDir, UPLOAD_EXTS)
    );

  if (!options.staticMode) {
    return app.get("/", () => "ElysiaJS is running!");
  }

  return app
    .get("/assets/*", async ({ request, status }) =>
      serveLocalFile(request, status, "/assets/", assetDir, ASSET_EXTS)
    )
    .get("/api/*", ({ status }) => status(404, { success: false, error: "NOT_FOUND" }))
    .get("*", () => Bun.file(clientIndexPath));
}
