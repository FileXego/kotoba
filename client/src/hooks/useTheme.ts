import { useState, useEffect } from "react";
import { getInitialTheme, nextTheme, type ThemeName } from "../theme/theme";
import { updateMe, type User } from "../api";

export function useTheme(user: User | null) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [inkAnim, setInkAnim] = useState<{ x: number; y: number; theme: ThemeName } | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (user) updateMe({ theme }).catch(() => {});
  }, [theme, user]);

  // apply theme after ink animation
  useEffect(() => {
    if (!inkAnim) return;
    const t = setTimeout(() => {
      setTheme(inkAnim.theme);
      requestAnimationFrame(() => setInkAnim(null));
    }, 600);
    return () => clearTimeout(t);
  }, [inkAnim]);

  const toggleTheme = (x?: number, y?: number) => {
    const next = nextTheme(theme);
    if (x !== undefined && y !== undefined) {
      setInkAnim({ x, y, theme: next });
    } else {
      setTheme(next);
    }
  };

  return { theme, toggleTheme, inkAnim };
}
