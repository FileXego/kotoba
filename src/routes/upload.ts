import { Elysia, t } from "elysia";
import { mkdirSync } from "node:fs";

const UPLOAD_DIR = import.meta.dir + "/../../uploads";

export const uploadRoute = new Elysia({ prefix: "/api" }).post(
  "/upload",
  async ({ body: { file } }) => {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filepath = UPLOAD_DIR + "/" + filename;
    await Bun.write(filepath, file);
    return { success: true, url: `/uploads/${filename}` };
  },
  {
    body: t.Object({
      file: t.File({ format: "image/png, image/jpeg, image/webp", maxSize: 2 * 1024 * 1024 }),
    }),
  }
);
