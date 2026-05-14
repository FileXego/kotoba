import { Elysia, t } from "elysia";
import { mkdirSync } from "node:fs";

const UPLOAD_DIR = import.meta.dir + "/../../uploads";

const MIME_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
};

export const uploadRoute = new Elysia({ prefix: "/api" }).post(
  "/upload",
  async ({ body: { file }, currentUser, status }) => {
    if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = MIME_EXT[file.type] ?? "bin";
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
