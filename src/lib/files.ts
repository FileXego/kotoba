import { mkdirSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";

const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const uploadDir = resolve(process.env.UPLOAD_DIR ?? "uploads");
export const assetDir = resolve("client/dist/assets");
export const clientIndexPath = resolve("client/dist/index.html");

export function ensureUploadDir() {
  mkdirSync(uploadDir, { recursive: true });
}

export function safeFileNameFromPath(request: Request, marker: string, allowedExts?: Set<string>) {
  const pathname = new URL(request.url).pathname;
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) return null;

  const encoded = pathname.slice(markerIndex + marker.length);
  if (!encoded) return null;

  let filename: string;
  try {
    filename = decodeURIComponent(encoded);
  } catch {
    return null;
  }

  if (filename !== basename(filename)) return null;
  if (!SAFE_FILE_NAME.test(filename) || filename.includes("..")) return null;

  const ext = filename.split(".").pop()?.toLowerCase();
  if (allowedExts && (!ext || !allowedExts.has(ext))) return null;

  return filename;
}

export function resolveInsideDir(dir: string, filename: string) {
  const root = resolve(dir);
  const target = resolve(root, filename);
  const rel = relative(root, target);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return target;
}

export async function serveLocalFile(
  request: Request,
  status: (code: number, response: { success: false; error: string }) => Response,
  marker: string,
  dir: string,
  allowedExts?: Set<string>,
) {
  const filename = safeFileNameFromPath(request, marker, allowedExts);
  if (!filename) return status(403, { success: false, error: "FORBIDDEN" });

  const path = resolveInsideDir(dir, filename);
  if (!path) return status(403, { success: false, error: "FORBIDDEN" });

  const file = Bun.file(path);
  if (!(await file.exists())) return status(404, { success: false, error: "NOT_FOUND" });
  return file;
}
