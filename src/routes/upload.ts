import { Elysia, t } from "elysia";
import { ensureUploadDir, uploadDir } from "../lib/files";
import { hasExpectedImageSignature, imageExtForMime } from "../lib/images";

export const uploadRoute = new Elysia({ prefix: "/api" }).post(
  "/upload",
  async ({ body: { file }, currentUser, status }) => {
    if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
    const ext = imageExtForMime(file.type);
    if (!ext || !(await hasExpectedImageSignature(file))) {
      return status(400, { success: false, error: "INVALID_FILE_TYPE" });
    }
    ensureUploadDir();
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filepath = uploadDir + "/" + filename;
    await Bun.write(filepath, file);
    return { success: true, url: `/uploads/${filename}` };
  },
  {
    body: t.Object({
      file: t.File({ format: "image/png, image/jpeg, image/webp", maxSize: 2 * 1024 * 1024 }),
    }),
  }
);
