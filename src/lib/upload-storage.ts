import { readdir, stat } from "node:fs/promises";
import { ensureUploadDir, uploadDir } from "./files";

export interface UploadReservation {
  commit(): Promise<void>;
  release(): Promise<void>;
}

export interface UploadCapacityGuard {
  reserve(bytes: number): Promise<UploadReservation | null>;
}

async function storedBytes(dir: string) {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      total += (await stat(`${dir}/${entry.name}`)).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return total;
}

export function createUploadCapacityGuard(dir: string, maxBytes: number): UploadCapacityGuard {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Upload capacity must be a positive safe integer");
  }

  let reservedBytes = 0;
  let gate: Promise<unknown> = Promise.resolve();
  const withLock = <T>(work: () => Promise<T> | T): Promise<T> => {
    const run = gate.then(work, work);
    gate = run.then(() => undefined, () => undefined);
    return run;
  };

  return {
    reserve(bytes) {
      if (!Number.isSafeInteger(bytes) || bytes <= 0) return Promise.resolve(null);
      return withLock(async () => {
        const used = await storedBytes(dir);
        if (used + reservedBytes + bytes > maxBytes) return null;
        reservedBytes += bytes;
        let settled = false;
        const settle = () => withLock(() => {
          if (!settled) {
            reservedBytes -= bytes;
            settled = true;
          }
        });
        return { commit: settle, release: settle };
      });
    },
  };
}

function configuredUploadLimit() {
  const raw = process.env.UPLOAD_MAX_BYTES;
  const parsed = raw ? Number(raw) : Number.NaN;
  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  if (process.env.NODE_ENV === "production" || import.meta.env.NODE_ENV === "production") {
    throw new Error("UPLOAD_MAX_BYTES must be a positive integer in production");
  }
  return 512 * 1024 * 1024;
}

ensureUploadDir();
export const uploadCapacity = createUploadCapacityGuard(uploadDir, configuredUploadLimit());
