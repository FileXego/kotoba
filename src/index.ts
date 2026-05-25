import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { bookmarkRoute } from "./routes/bookmark";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { admin } from "./plugins/admin";

const app = new Elysia({
  sanitize: (value) => Bun.escapeHTML(value),
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
  .get("/api/health", () => ({ success: true, version: "1.0.0" }))
  .get("/", () => "🦊 ElysiaJS is running!")
  .get("/uploads/*", ({ request, status }) => {
    const url = new URL(request.url);
    const filename = url.pathname.split("/uploads/")[1];
    if (!filename || filename.includes("..")) return status(403, { success: false, error: "FORBIDDEN" });
    return Bun.file(`./uploads/${filename}`);
  })
  .listen(3000);

console.log(`🚀 Server running at http://localhost:${app.server?.port}`);
