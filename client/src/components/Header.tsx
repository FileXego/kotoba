import { useState, useEffect, useRef, type FormEvent } from "react";
import { signUp, signIn, signOut, type User } from "../api";
import { t, parseApiError, type Lang, type Key } from "../i18n";
import { type ThemeName, nextTheme } from "../theme/theme";
import {
  mountTurnstileWidget,
  resetTurnstileWidget,
  resolveTurnstileSiteKey,
  TURNSTILE_SCRIPT_ID,
} from "../config";

const themeKeys: Record<ThemeName, Key> = {
  light: "theme.light", dark: "theme.dark", sumi: "theme.sumi", sakura: "theme.sakura",
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string }) => string;
      getResponse: (id?: string) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
    __KOTOBA_TURNSTILE_SITEKEY__?: string;
  }
}

const SITE_KEY = resolveTurnstileSiteKey({
  buildKey: import.meta.env.VITE_TURNSTILE_SITEKEY,
  runtimeKey: window.__KOTOBA_TURNSTILE_SITEKEY__,
  production: import.meta.env.PROD,
});

interface Props {
  theme: ThemeName; lang: Lang;
  onToggleTheme: (x: number, y: number) => void; onToggleLang: () => void;
  user: User | null; onUserChange: (user: User | null) => void;
  onAdminClick: () => void; onBookmarksClick: () => void; onHomeClick: () => void;
}

export function Header({ theme, lang, onToggleTheme, onToggleLang, user, onUserChange, onAdminClick, onBookmarksClick, onHomeClick }: Props) {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!SITE_KEY || !showAuth || mode !== "up" || !captchaRef.current) {
      widgetId.current = undefined;
      return;
    }
    return mountTurnstileWidget({
      script: document.getElementById(TURNSTILE_SCRIPT_ID),
      getTurnstile: () => window.turnstile,
      container: captchaRef.current,
      siteKey: SITE_KEY,
      onWidgetId: (id) => { widgetId.current = id; },
    });
  }, [showAuth, mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      let token = "";
      if (mode === "up") {
        if (!SITE_KEY) {
          setError(t(lang, "auth.configError"));
          setLoading(false);
          return;
        }
        token = window.turnstile?.getResponse(widgetId.current) ?? "";
        if (!token) { setError(t(lang, "auth.captcha")); setLoading(false); return; }
      }
      const result = mode === "up"
        ? await signUp(username, email, password, token) : await signIn(username, password);
      if (result.success && result.user) {
        onUserChange(result.user); setShowAuth(false); setUsername(""); setEmail(""); setPassword("");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(parseApiError(lang, msg, "auth.network"));
    }
    finally { setLoading(false); resetTurnstileWidget(window.turnstile, widgetId.current); }
  };

  const handleSignOut = async () => { await signOut(); onUserChange(null); };

  return (
    <header className="header">
      <div className="header-toggles">
        <button type="button" className="theme-toggle" onClick={(e) => onToggleTheme(e.clientX, e.clientY)}
          aria-label={t(lang, themeKeys[nextTheme(theme)])}
          title={t(lang, themeKeys[nextTheme(theme)])}>
          {theme === "light" ? "☀" : theme === "dark" ? "☾" : theme === "sumi" ? "墨" : "桜"}
        </button>
        <button type="button" className="lang-toggle" onClick={onToggleLang}
          aria-label={t(lang, lang === "ja" ? "lang.zh" : "lang.ja")}>
          {lang === "ja" ? "中" : "日"}
        </button>
      </div>
      <div className="header-issue">
        <span>{t(lang, "editorial.issue")}</span>
        <span aria-hidden="true">{t(lang, "editorial.navHomeMark")}</span>
      </div>
      <div className="header-masthead">
        <button type="button" className="header-title-button" onClick={onHomeClick}>
          <span className="header-title">{t(lang, "app.title")}</span>
        </button>
        <span className="header-seal" aria-hidden="true">{t(lang, "editorial.seal")}</span>
      </div>
      <p className="header-sub">{t(lang, "app.subtitle")}</p>
      <div className="auth-area">
        {user ? (
          <div className="auth-user">
            <span className="auth-username">{user.username}</span>
            <button type="button" className="auth-btn auth-bookmarks-btn" onClick={onBookmarksClick}>{t(lang, "bookmarks.title")}</button>
            {user.isAdmin ? <button type="button" className="auth-btn admin-link" onClick={onAdminClick}>{t(lang, "admin.title")}</button> : null}
            <button type="button" className="auth-btn auth-logout-btn" onClick={handleSignOut}>{t(lang, "auth.logout")}</button>
          </div>
        ) : (
          <button type="button" className="auth-btn" onClick={() => setShowAuth(!showAuth)}>
            {showAuth ? t(lang, "auth.close") : t(lang, "auth.login")}
          </button>
        )}
      </div>
      {showAuth && !user && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs">
            <button type="button" className={`auth-tab ${mode === "in" ? "active" : ""}`}
              onClick={() => setMode("in")}>{t(lang, "auth.signIn")}</button>
            <button type="button" className={`auth-tab ${mode === "up" ? "active" : ""}`}
              onClick={() => setMode("up")}>{t(lang, "auth.signUp")}</button>
          </div>
          <input className="auth-input" type="text" autoComplete="username" placeholder={t(lang, "auth.username")}
            value={username} onChange={(e) => setUsername(e.target.value)} required />
          {mode === "up" && (
            <input className="auth-input" type="email" autoComplete="email" placeholder={t(lang, "auth.email")}
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          )}
          <input className="auth-input" type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder={t(lang, "auth.password")}
            value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {mode === "up" && SITE_KEY && <div ref={captchaRef} className="captcha-widget" />}
          {mode === "up" && !SITE_KEY && <p className="auth-error">{t(lang, "auth.configError")}</p>}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading || (mode === "up" && !SITE_KEY)}>
            {loading ? "..." : mode === "in" ? t(lang, "auth.signIn") : t(lang, "auth.signUp")}
          </button>
        </form>
      )}
      <div className="header-line" />
    </header>
  );
}
