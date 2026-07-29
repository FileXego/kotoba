import { Elysia, t } from "elysia";
import { ensureUploadDir, uploadDir } from "../lib/files";
import { hasExpectedImageSignature, imageExtForMime } from "../lib/images";
import { unlink } from "node:fs/promises";
import { uploadCapacity } from "../lib/upload-storage";

export const uploadRoute = new Elysia({ prefix: "/api" }).post(
  "/upload",
  async ({ body: { file }, currentUser, status }) => {
    if (!currentUser) return status(401, { success: false, error: "AUTH_REQUIRED" });
    const ext = imageExtForMime(file.type);
    if (!ext || !(await hasExpectedImageSignature(file))) {
      return status(400, { success: false, error: "INVALID_FILE_TYPE" });
    }
    const reservation = await uploadCapacity.reserve(file.size);
    if (!reservation) return status(507, { success: false, error: "STORAGE_LIMIT" });
    ensureUploadDir();
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filepath = uploadDir + "/" + filename;
    try {
      await Bun.write(filepath, file);
      await reservation.commit();
      return { success: true, url: `/uploads/${filename}` };
    } catch (error) {
      await reservation.release();
      await unlink(filepath).catch(() => undefined);
      console.error("Upload write failed:", error instanceof Error ? error.message : String(error));
      return status(500, { success: false, error: "INTERNAL_ERROR" });
    }
  },
  {
    body: t.Object({
      file: t.File({ format: "image/png, image/jpeg, image/webp", maxSize: 2 * 1024 * 1024 }),
    }),
  }
);
