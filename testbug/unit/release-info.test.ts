import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { basename, dirname, join, resolve } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readReleaseRevision } from "../../src/lib/release-info";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnvironmentRevision = process.env.KOTOBA_REVISION;
const temporaryDirectories: string[] = [];

function createReleaseRoot(revision?: string) {
  const directory = mkdtempSync(join(tmpdir(), "kotoba-test-release-info-"));
  temporaryDirectories.push(directory);
  if (revision !== undefined) {
    writeFileSync(join(directory, ".release-revision"), revision, "utf8");
  }
  return directory;
}

function restoreEnvironment(name: "NODE_ENV" | "KOTOBA_REVISION", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("release revision", () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.KOTOBA_REVISION;
  });

  afterEach(() => {
    restoreEnvironment("NODE_ENV", originalNodeEnv);
    restoreEnvironment("KOTOBA_REVISION", originalEnvironmentRevision);

    const resolvedTemporaryRoot = resolve(tmpdir());
    for (const directory of temporaryDirectories.splice(0)) {
      const resolvedDirectory = resolve(directory);
      if (
        dirname(resolvedDirectory) !== resolvedTemporaryRoot
        || !basename(resolvedDirectory).startsWith("kotoba-test-release-info-")
      ) {
        throw new Error("Refusing to remove a non-test release-info directory");
      }
      rmSync(resolvedDirectory, { recursive: true, force: true });
    }
  });

  it("uses the release-root SHA and ignores KOTOBA_REVISION in production", () => {
    const fileRevision = "0123456789abcdef0123456789abcdef01234567";
    const releaseRoot = createReleaseRoot(fileRevision);
    process.env.NODE_ENV = "production";
    process.env.KOTOBA_REVISION = "ffffffffffffffffffffffffffffffffffffffff";

    expect(readReleaseRevision(releaseRoot)).toBe(fileRevision);
  });

  it("does not allow KOTOBA_REVISION to replace a missing production release file", () => {
    const releaseRoot = createReleaseRoot();
    process.env.NODE_ENV = "production";
    process.env.KOTOBA_REVISION = "ffffffffffffffffffffffffffffffffffffffff";

    expect(() => readReleaseRevision(releaseRoot)).toThrow("Release revision is unavailable");
  });

  it("rejects production release files that are not one complete lowercase SHA", () => {
    process.env.NODE_ENV = "production";

    for (const revision of [
      "0123456789abcdef0123456789abcdef0123456",
      "0123456789abcdef0123456789abcdef012345678",
      "0123456789abcdef0123456789abcdef0123456g",
      "0123456789ABCDEF0123456789ABCDEF01234567",
    ]) {
      const releaseRoot = createReleaseRoot(revision);
      expect(() => readReleaseRevision(releaseRoot)).toThrow("Release revision is unavailable");
    }
  });

  it("preserves development revision injection for isolated tests", () => {
    const releaseRoot = createReleaseRoot("file-development-revision");
    process.env.NODE_ENV = "test";
    process.env.KOTOBA_REVISION = "injected-test-revision";

    expect(readReleaseRevision(releaseRoot)).toBe("injected-test-revision");
  });
});
