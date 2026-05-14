import { Elysia, t } from "elysia";

const TURNSTILE_SECRET = import.meta.env.TURNSTILE_SECRET ?? "1x0000000000000000000000000000000AA";

export const captcha = new Elysia({ prefix: "/api" })
  .model({
    captchaToken: t.Object({ token: t.String() }),
  })
  .post(
    "/captcha/verify",
    async ({ body }) => {
      try {
        const formData = new FormData();
        formData.append("secret", TURNSTILE_SECRET);
        formData.append("response", body.token);
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData });
        const data = await res.json();
        return { success: data.success as boolean };
      } catch {
        return { success: false };
      }
    },
    { body: "captchaToken" }
  );
