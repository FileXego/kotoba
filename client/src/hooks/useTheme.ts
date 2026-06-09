import { useState, useEffect, useRef } from "react";
import { getInitialTheme, nextTheme, type ThemeName } from "../theme/theme";
import { updateMe, type User } from "../api";

export function useTheme(user: User | null) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [inkAnim, setInkAnim] = useState<{ x: number; y: number; theme: ThemeName } | null>(null);
  const lastUserId = useRef<number | null>(null);

  // Pull theme from server on first login per user session
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user && user.id !== lastUserId.current) {
      lastUserId.current = user.id;
      if (user.theme && user.theme !== theme) setTheme(user.theme);
    }
  }, [user, theme]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync local theme to DOM + server
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (user) updateMe({ theme }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // apply theme after ink animation
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!inkAnim) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(inkAnim.theme);
      setInkAnim(null);
      return;
    }
    const t = setTimeout(() => {
      setTheme(inkAnim.theme);
      requestAnimationFrame(() => setInkAnim(null));
    }, 600);
    return () => clearTimeout(t);
  }, [inkAnim]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
