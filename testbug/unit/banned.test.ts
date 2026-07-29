import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BUN = process.execPath;

async function runBun(code: string, cwd: string) {
  const child = Bun.spawn({
    cmd: [BUN, "-e", code],
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("banned-word loader", () => {
  it("resolves the repository list independently of the process working directory", async () => {
    const isolatedCwd = mkdtempSync(join(tmpdir(), "kotoba-banned-cwd-"));
    try {
      const moduleUrl = pathToFileURL(resolve("src/lib/banned.ts")).href;
      const result = await runBun(
        `const { loadBannedWords } = await import(${JSON.stringify(moduleUrl)}); await loadBannedWords();`,
        isolatedCwd,
      );
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("moderation filter disabled");
    } finally {
      rmSync(isolatedCwd, { recursive: true, force: true });
    }
  });

  it("ignores comments while matching configured words", async () => {
    const isolatedCwd = mkdtempSync(join(tmpdir(), "kotoba-banned-list-"));
    const listPath = join(isolatedCwd, "banned.txt");
    await Bun.write(listPath, "# explanatory comment\nblocked-token\n\n");
    expect(existsSync(listPath)).toBe(true);

    try {
      const moduleUrl = pathToFileURL(resolve("src/lib/banned.ts")).href;
      const result = await runBun(
        [
          `const { loadBannedWords } = await import(${JSON.stringify(moduleUrl)});`,
          `const filter = await loadBannedWords(${JSON.stringify(listPath)});`,
          `console.log(JSON.stringify({ comment: filter.containsAny("explanatory comment"), blocked: filter.containsAny("blocked-token") }));`,
        ].join(" "),
        isolatedCwd,
      );
      expect(result.exitCode, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout.trim())).toEqual({ comment: false, blocked: true });
    } finally {
      rmSync(isolatedCwd, { recursive: true, force: true });
    }
  });
});
