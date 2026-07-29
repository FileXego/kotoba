import { describe, expect, it } from "bun:test";

const ci = await Bun.file(".github/workflows/ci.yml").text();
const monitor = await Bun.file(".github/workflows/project-monitor.yml").text();
const bunfig = await Bun.file("bunfig.toml").text();
const rootPackage = await Bun.file("package.json").json() as {
  packageManager?: string;
  overrides?: Record<string, string>;
};

describe("release workflows", () => {
  it("use the repository-pinned Bun version and frozen installs", () => {
    expect(ci).not.toContain("bun-version: latest");
    expect(monitor).not.toContain("bun-version: latest");
    expect(rootPackage.packageManager).toBe("bun@1.3.11");
    expect(ci).toContain("bun install --frozen-lockfile");
    expect(ci).toContain("bun install --cwd client --frozen-lockfile");
    expect(monitor).toContain("bun install --frozen-lockfile");
    expect(monitor).toContain("bun install --cwd client --frozen-lockfile");
  });

  it("builds the same mobile-route configuration selected for production", () => {
    for (const workflow of [ci, monitor]) {
      expect(workflow).toContain('VITE_MOBILE_ROUTES_ENABLED: "true"');
      expect(workflow).not.toContain('VITE_MOBILE_ROUTES_ENABLED: "false"');
    }
  });

  it("does not gate on unsupported standalone backend type inference", () => {
    expect(ci).not.toContain("bun run typecheck");
    expect(ci).toContain("bun run src/index.ts");
  });

  it("checks committed migrations and the actual production entrypoint", () => {
    expect(ci).toContain("git diff --exit-code -- drizzle/migrations");
    expect(ci).toContain("bun run src/start.ts");
    for (const workflow of [ci, monitor]) {
      expect(workflow).toContain('RELEASE_REVISION: ${{ github.sha }}');
      expect(workflow).toContain("printf '%s\\n' \"$RELEASE_REVISION\" > .release-revision");
      expect(workflow).toContain("rm -f .release-revision");
      expect(workflow).not.toContain("EXPECTED_VERSION:");
      expect(workflow).toContain('EXPECTED_VERSION="$(bun -e');
      expect(workflow).toContain('Bun.file("package.json").json()');
      expect(workflow).toContain("body.success === true");
      expect(workflow).toContain('body.status === "ready"');
      expect(workflow).toContain("body.version === process.env.EXPECTED_VERSION");
      expect(workflow).toContain("body.revision === process.env.RELEASE_REVISION");
      expect(workflow).not.toContain('grep -F "\\"revision\\":\\"${RELEASE_REVISION}\\""');
      expect(workflow).not.toContain("KOTOBA_REVISION:");
      expect(workflow.indexOf("trap cleanup EXIT")).toBeLessThan(
        workflow.indexOf("printf '%s\\n' \"$RELEASE_REVISION\" > .release-revision"),
      );
    }
  });

  it("runs both dependency audits against the official registry", () => {
    for (const workflow of [ci, monitor]) {
      expect(workflow).toContain("bun audit --registry=https://registry.npmjs.org");
      expect(workflow).toContain("bun audit --cwd client --registry=https://registry.npmjs.org");
      expect(workflow).not.toContain("--audit-level=");
    }
  });

  it("keeps the patched esbuild graph and official registry policy in version control", () => {
    expect(rootPackage.overrides?.esbuild).toBe("0.25.12");
    expect(bunfig).toContain('registry = "https://registry.npmjs.org"');
  });

  it("pins every GitHub Action to an immutable full commit SHA", () => {
    for (const workflow of [ci, monitor]) {
      expect(workflow).not.toMatch(/uses:\s+\S+@v\d+/);
      expect(workflow).toContain("actions/checkout@11d5960a326750d5838078e36cf38b85af677262");
      expect(workflow).toContain("oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6");
    }
    expect(monitor).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
  });
});
