import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { captcha } from "./plugins/captcha";
import { admin } from "./plugins/admin";

const app = new Elysia({
  sanitize: (value) => Bun.escapeHTML(value),
})
  .use(rateLimiter)
  .use(auth)
  .use(captcha)
  .use(admin)
  .use(messageRoute)
  .use(uploadRoute)
  .get("/", () => "🦊 ElysiaJS is running!")
  .get("/uploads/*", ({ request, set }) => {
    const url = new URL(request.url);
    const filename = url.pathname.split("/uploads/")[1];
    if (!filename || filename.includes("..")) { set.status = 403; return ""; }
    return Bun.file(`./uploads/${filename}`);
  })
  .listen(3000);

console.log(`🚀 Server running at http://localhost:${app.server?.port}`);
