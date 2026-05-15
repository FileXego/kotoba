import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { admin } from "./plugins/admin";

const app = new Elysia({
  sanitize: (value) => Bun.escapeHTML(value),
})
  .use(rateLimiter)
  .use(auth)
  .use(admin)
  .use(messageRoute)
  .use(uploadRoute)
  .get("/", () => "🦊 ElysiaJS is running!")
  .get("/uploads/*", ({ request, status }) => {
    const url = new URL(request.url);
    const filename = url.pathname.split("/uploads/")[1];
    if (!filename || filename.includes("..")) return status(403, { success: false, error: "FORBIDDEN" });
    return Bun.file(`./uploads/${filename}`);
  })
  .listen(3000);

console.log(`🚀 Server running at http://localhost:${app.server?.port}`);
