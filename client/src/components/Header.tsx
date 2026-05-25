import { useState, useEffect, useRef, type FormEvent } from "react";
import { signUp, signIn, signOut, type User } from "../api";
import { t, type Lang } from "../i18n";

declare global { interface Window { turnstile: { render: (el: HTMLElement, opts: { sitekey: string }) => string; getResponse: (id?: string) => string; reset: (id?: string) => void } } }
const SITE_KEY = "1x00000000000000000000AA";

interface Props {
  theme: "light" | "dark"; lang: Lang;
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
    if (showAuth && mode === "up" && captchaRef.current && !widgetId.current) {
      widgetId.current = window.turnstile?.render(captchaRef.current, { sitekey: SITE_KEY });
    }
    return () => { widgetId.current = undefined; };
  }, [showAuth, mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      let token = "";
      if (mode === "up") {
        token = window.turnstile?.getResponse(widgetId.current) ?? "";
        if (!token) { setError(t(lang, "auth.captcha")); setLoading(false); return; }
      }
      const result = mode === "up"
        ? await signUp(username, email, password, token) : await signIn(username, password);
      if (result.success && result.user) {
        onUserChange(result.user); setShowAuth(false); setUsername(""); setEmail(""); setPassword("");
      } else { // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setError(t(lang, ("error." + result.error) as any) || result.error || t(lang, "auth.error")); }
    } catch { setError(t(lang, "auth.network")); }
    finally { setLoading(false); window.turnstile?.reset(widgetId.current); }
  };

  const handleSignOut = async () => { await signOut(); onUserChange(null); };

  return (
    <header className="header">
      <div className="header-toggles">
        <button className="theme-toggle" onClick={(e) => onToggleTheme(e.clientX, e.clientY)}
          aria-label={t(lang, theme === "light" ? "theme.dark" : "theme.light")}
          title={t(lang, theme === "light" ? "theme.dark" : "theme.light")}>
          {theme === "light" ? "月" : "日"}
        </button>
        <button className="lang-toggle" onClick={onToggleLang}
          aria-label={t(lang, lang === "ja" ? "lang.zh" : "lang.ja")}>
          {lang === "ja" ? "中" : "日"}
        </button>
      </div>
      <h1 className="header-title" onClick={onHomeClick} style={{ cursor: "pointer" }}>{t(lang, "app.title")}</h1>
      <p className="header-sub">{t(lang, "app.subtitle")}</p>
      <div className="auth-area">
        {user ? (
          <div className="auth-user">
            <span className="auth-username">{user.username}</span>
            <button className="auth-btn" onClick={onBookmarksClick}>{t(lang, "bookmarks.title")}</button>
            {user.isAdmin ? <button className="auth-btn admin-link" onClick={onAdminClick}>{t(lang, "admin.title")}</button> : null}
            <button className="auth-btn" onClick={handleSignOut}>{t(lang, "auth.logout")}</button>
          </div>
        ) : (
          <button className="auth-btn" onClick={() => setShowAuth(!showAuth)}>
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
          <input className="auth-input" type="text" placeholder={t(lang, "auth.username")}
            value={username} onChange={(e) => setUsername(e.target.value)} required />
          {mode === "up" && (
            <input className="auth-input" type="email" placeholder={t(lang, "auth.email")}
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          )}
          <input className="auth-input" type="password" placeholder={t(lang, "auth.password")}
            value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {mode === "up" && <div ref={captchaRef} className="captcha-widget" />}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "..." : mode === "in" ? t(lang, "auth.signIn") : t(lang, "auth.signUp")}
          </button>
        </form>
      )}
      <div className="header-line" />
    </header>
  );
}