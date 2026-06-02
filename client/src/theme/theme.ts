export type ThemeName = "light" | "dark" | "sumi" | "sakura";

const THEME_CYCLE: ThemeName[] = ["light", "dark", "sumi", "sakura"];

export function normalizeThemeName(s: string | null | undefined): ThemeName {
  if (s === "light" || s === "dark" || s === "sumi" || s === "sakura") return s;
  return "light";
}

export function nextTheme(current: ThemeName): ThemeName {
  const i = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(i + 1) % THEME_CYCLE.length];
}

export function getInitialTheme(): ThemeName {
  const stored = localStorage.getItem("theme");
  const fromStored = normalizeThemeName(stored);
  // only light/dark from system preference; sumi/sakura must be explicit
  if (stored) return fromStored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
