import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf8")) as {
  version?: unknown;
};

if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
  throw new Error("package.json must declare a non-empty version");
}

export const APP_VERSION = packageJson.version;

export function readReleaseRevision(projectRoot = PROJECT_ROOT) {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const environmentRevision = process.env.KOTOBA_REVISION?.trim();
    if (environmentRevision) return environmentRevision.slice(0, 128);
  }

  try {
    const revision = readFileSync(resolve(projectRoot, ".release-revision"), "utf8").trim();
    if (isProduction && !/^[0-9a-f]{40}$/.test(revision)) {
      throw new Error("Release revision is unavailable");
    }
    return revision ? revision.slice(0, 128) : "development";
  } catch {
    if (isProduction) {
      throw new Error("Release revision is unavailable");
    }
    return "development";
  }
}
