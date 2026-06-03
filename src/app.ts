import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { bookmarkRoute } from "./routes/bookmark";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { admin } from "./plugins/admin";

export interface AppOptions {
  staticMode?: boolean;
}

function fileNameFromPath(request: Request, marker: string) {
  const url = new URL(request.url);
  const filename = url.pathname.split(marker)[1];
  if (!filename || filename.includes("..")) return null;
  return filename;
}

export function createApp(options: AppOptions = {}) {
  const app = new Elysia({
    sanitize: (value) => (typeof value === "string" ? Bun.escapeHTML(value) : value),
  })
    .state("csp", "default-src 'self'; script-src 'self' https://challenges.cloudflare.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'")
    .onAfterHandle(({ set, store: { csp } }) => {
      set.headers["Content-Security-Policy"] = csp;
    })
    .onError(({ code, status, error }) => {
      if (code === "VALIDATION") return status(422, { success: false, error: "VALIDATION" });
      if (code === "NOT_FOUND") return status(404, { success: false, error: "NOT_FOUND" });
      console.error(error);
      return status(500, { success: false, error: "INTERNAL_ERROR" });
    })
    .use(rateLimiter)
    .use(auth)
    .use(admin)
    .use(messageRoute)
    .use(bookmarkRoute)
    .use(uploadRoute)
    .get("/api/health", () => ({ success: true, version: "2.1.0" }))
    .get("/uploads/*", async ({ request, status }) => {
      const filename = fileNameFromPath(request, "/uploads/");
      if (!filename) return status(403, { success: false, error: "FORBIDDEN" });
      const file = Bun.file(`./uploads/${filename}`);
      if (!(await file.exists())) return status(404, { success: false, error: "NOT_FOUND" });
      return file;
    });

  if (!options.staticMode) {
    return app.get("/", () => "ElysiaJS is running!");
  }

  return app
    .get("/assets/*", async ({ request, status }) => {
      const filename = fileNameFromPath(request, "/assets/");
      if (!filename) return status(403, { success: false, error: "FORBIDDEN" });
      const file = Bun.file(`./client/dist/assets/${filename}`);
      if (!(await file.exists())) return status(404, { success: false, error: "NOT_FOUND" });
      return file;
    })
    .get("/api/*", ({ status }) => status(404, { success: false, error: "NOT_FOUND" }))
    .get("*", () => Bun.file("./client/dist/index.html"));
}