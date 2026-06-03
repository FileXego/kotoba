import { useState, useEffect, useRef } from "react";
import { getInitialTheme, nextTheme, type ThemeName } from "../theme/theme";
import { updateMe, type User } from "../api";

export function useTheme(user: User | null) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [inkAnim, setInkAnim] = useState<{ x: number; y: number; theme: ThemeName } | null>(null);
  const lastUserId = useRef<number | null>(null);

  // Pull theme from server on first login per user session
  useEffect(() => {
    if (user && user.id !== lastUserId.current) {
      lastUserId.current = user.id;
      if (user.theme && user.theme !== theme) setTheme(user.theme);
    }
  }, [user, theme]);

  // Sync local theme to DOM + server
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (user) updateMe({ theme }).catch(() => {});
  }, [theme]);

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
