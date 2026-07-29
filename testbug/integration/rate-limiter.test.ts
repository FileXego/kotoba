import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const temporaryDirectories: string[] = [];

async function runIsolated(code: string) {
  const directory = mkdtempSync(join(tmpdir(), "kotoba-rate-limit-"));
  temporaryDirectories.push(directory);
  const child = Bun.spawn({
    cmd: [process.execPath, "-e", code],
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { directory, stdout, stderr, exitCode };
}

function childPreamble(databasePath: string, production = false) {
  const appUrl = pathToFileURL(resolve("src/app.ts")).href;
  const migrations = resolve("drizzle/migrations");
  const uploadPath = join(resolve(databasePath, ".."), "uploads");
  return `
process.env.TEST_DB = ${JSON.stringify(databasePath)};
process.env.COOKIE_SECRET = "0123456789abcdef0123456789abcdef";
process.env.TURNSTILE_SECRET = "real-turnstile-secret";
process.env.UPLOAD_DIR = ${JSON.stringify(uploadPath)};
process.env.UPLOAD_MAX_BYTES = "33554432";
delete process.env.SKIP_RATE_LIMIT;
${production
    ? `process.env.NODE_ENV = "production"; delete process.env.SKIP_CAPTCHA;`
    : `delete process.env.NODE_ENV; process.env.SKIP_CAPTCHA = "1";`}
const { Database } = await import("bun:sqlite");
const { drizzle } = await import("drizzle-orm/bun-sqlite");
const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
const sqlite = new Database(process.env.TEST_DB);
migrate(drizzle(sqlite), { migrationsFolder: ${JSON.stringify(migrations)} });
sqlite.close();
const { createApp } = await import(${JSON.stringify(appUrl)});
const app = await createApp({
  staticMode: false,
  revision: "0123456789abcdef0123456789abcdef01234567",
});
`;
}

describe("rate limiter integration", () => {
  afterAll(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("cannot be bypassed with rotating X-Forwarded-For or trailing slashes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kotoba-rate-db-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "rate.db");
    const result = await runIsolated(`
${childPreamble(databasePath)}
const signInStatuses = [];
for (let i = 0; i < 11; i++) {
  const response = await app.handle(new Request("http://localhost/api/auth/sign-in/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "X-Forwarded-For": \`198.51.100.\${i + 1}\`,
    },
    body: JSON.stringify({ username: "missing", password: "wrong-password" }),
  }));
  signInStatuses.push(response.status);
}

const signUp = await app.handle(new Request("http://localhost/api/auth/sign-up", {
  method: "POST",
  headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
  body: JSON.stringify({
    username: "rate-user",
    email: "rate-user@example.test",
    password: "123456",
    captchaToken: "test-token",
  }),
}));
const cookie = signUp.headers.get("Set-Cookie")?.match(/session=([^;]+)/)?.[1];
if (!cookie) throw new Error("No session cookie from sign-up");

const messageStatuses = [];
for (let i = 0; i < 16; i++) {
  const response = await app.handle(new Request("http://localhost/api/message/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "Cookie": \`session=\${cookie}\`,
    },
    body: JSON.stringify({ content: \`rate message \${i}\` }),
  }));
  messageStatuses.push(response.status);
}
console.log(JSON.stringify({ signInStatuses, messageStatuses }));
process.exit(0);
`);
    expect(result.exitCode, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout.trim()) as {
      signInStatuses: number[];
      messageStatuses: number[];
    };
    expect(output.signInStatuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(output.signInStatuses[10]).toBe(429);
    expect(output.messageStatuses.slice(0, 15)).toEqual(Array(15).fill(200));
    expect(output.messageStatuses[15]).toBe(429);
  });

  it("applies the production bot gate to a trailing-slash read path", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kotoba-rate-prod-db-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "rate-production.db");
    const result = await runIsolated(`
${childPreamble(databasePath, true)}
const response = await app.handle(new Request("http://localhost/api/messages/", {
  headers: { "User-Agent": "Mozilla/5.0" },
}));
console.log(response.status);
process.exit(0);
`);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(Number(result.stdout.trim())).toBe(403);
  });
});
