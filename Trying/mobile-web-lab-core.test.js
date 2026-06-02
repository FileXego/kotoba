import { describe, expect, test } from "bun:test";

await import("./mobile-web-lab-core.js");

const core = globalThis.KotobaMobileLabCore;

describe("mobile web lab core", () => {
  test("formal flags default to off unless explicitly true", () => {
    expect(core.formalFlagsFromEnv({})).toEqual({
      mobileWebEnabled: false,
      mobileEffectsEnabled: false,
      mobileRoutesEnabled: false,
    });

    expect(core.formalFlagsFromEnv({
      VITE_MOBILE_WEB_ENABLED: "true",
      VITE_MOBILE_EFFECTS_ENABLED: "true",
      VITE_MOBILE_ROUTES_ENABLED: "true",
    })).toEqual({
      mobileWebEnabled: true,
      mobileEffectsEnabled: true,
      mobileRoutesEnabled: true,
    });
  });

  test("theme keys normalize to formal contract", () => {
    expect(core.normalizeThemeKey("washi")).toBe("light");
    expect(core.normalizeThemeKey("night")).toBe("dark");
    expect(core.normalizeThemeKey("sumi")).toBe("sumi");
    expect(core.normalizeThemeKey("unknown")).toBe("light");
  });

  test("initial route supports query and hash review links", () => {
    expect(core.initialRouteFromLocation({ search: "", hash: "#bookmarks" })).toBe("bookmarks");
    expect(core.initialRouteFromLocation({ search: "", hash: "#/thread" })).toBe("thread");
    expect(core.initialRouteFromLocation({ search: "?route=me", hash: "#bookmarks" })).toBe("me");
    expect(core.initialRouteFromLocation({ search: "", hash: "#unsafe" })).toBe("home");
  });

  test("live API is read-only", () => {
    const flags = core.parseLabFlags("?api=live");
    expect(core.apiMode(flags)).toBe("live-readonly");
    expect(core.canWriteToApi(flags)).toBe(false);
  });

  test("live API requires an http origin", () => {
    expect(core.canUseSameOriginApi({ protocol: "file:" })).toBe(false);
    expect(core.canUseSameOriginApi({ protocol: "http:" })).toBe(true);
    expect(core.canUseSameOriginApi({ protocol: "https:" })).toBe(true);
    expect(core.liveApiUnavailableReason({ protocol: "file:" })).toContain("file://");
    expect(core.liveApiUnavailableReason({ protocol: "https:" })).toBe("");
  });

  test("sumi uses a distinct dark ink token set", () => {
    expect(core.THEME_TOKENS.sumi.bg).not.toBe(core.THEME_TOKENS.light.bg);
    expect(core.THEME_TOKENS.sumi.surface).not.toBe(core.THEME_TOKENS.light.surface);
    expect(core.THEME_TOKENS.sumi.text).toBe("#eef2ea");
  });

  test("mock mode can create local-only posts", () => {
    const flags = core.parseLabFlags("");
    expect(core.apiMode(flags)).toBe("mock");
    expect(core.canWriteToApi(flags)).toBe(true);
  });

  test("Android-style back behavior returns non-home routes to home", () => {
    expect(core.routeAfterBack("thread")).toBe("home");
    expect(core.routeAfterBack("bookmarks")).toBe("home");
    expect(core.routeAfterBack("me")).toBe("home");
    expect(core.routeAfterBack("home")).toBe("exit");
  });

  test("image token uses safe uploads preview path", () => {
    expect(core.imageTokenFromFileName("My Photo.PNG")).toBe("[image:/uploads/demo-my-photo.png]");
    expect(core.imageTokenFromFileName("../evil.svg")).toBe("[image:/uploads/demo-evil.svg.jpg]");
  });

  test("reduced motion disables decorative movement", () => {
    expect(core.reducedMotionPolicy(true)).toEqual({
      paperCardEntrance: false,
      dustBreathing: false,
      inkTransition: false,
      themeSwitchMode: "instant",
    });

    expect(core.reducedMotionPolicy(false).themeSwitchMode).toBe("ink");
  });
});
