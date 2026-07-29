import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUploadCapacityGuard } from "../../src/lib/upload-storage";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeDir() {
  const dir = mkdtempSync(join(tmpdir(), "kotoba-upload-"));
  tempDirs.push(dir);
  return dir;
}

describe("upload capacity guard", () => {
  it("counts existing files and refuses a reservation over the hard limit", async () => {
    const dir = makeDir();
    const existing = join(dir, "existing.png");
    writeFileSync(existing, "");
    truncateSync(existing, 80);
    const guard = createUploadCapacityGuard(dir, 100);

    expect(await guard.reserve(21)).toBeNull();
    const exact = await guard.reserve(20);
    expect(exact).not.toBeNull();
    await exact!.release();
  });

  it("holds concurrent reservations and releases capacity after a failed write", async () => {
    const dir = makeDir();
    const guard = createUploadCapacityGuard(dir, 100);
    const first = await guard.reserve(100);
    expect(first).not.toBeNull();
    expect(await guard.reserve(1)).toBeNull();

    await first!.release();
    const retry = await guard.reserve(100);
    expect(retry).not.toBeNull();
    await retry!.commit();
  });
});
