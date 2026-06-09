import { MOBILE_ROUTES_ENABLED } from "../flags";
import { t, type Lang } from "../i18n";

type Route = "/" | "/admin" | "/bookmarks" | "/message" | "/me";

interface Props {
  lang: Lang;
  route: Route;
  navigate: (r: Route, id?: number) => void;
  onComposeFocus: () => void;
}

export function MobileBottomNav({ lang, route, navigate, onComposeFocus }: Props) {
  if (!MOBILE_ROUTES_ENABLED) return null;

  return (
    <nav className="mobile-nav" aria-label={t(lang, "nav.mobile")}>
      <button
        className={`mobile-nav-btn ${route === "/" ? "active" : ""}`}
        onClick={() => navigate("/")}
      >
        {t(lang, "nav.home")}
      </button>
      <button
        className={`mobile-nav-btn ${route === "/bookmarks" ? "active" : ""}`}
        onClick={() => navigate("/bookmarks")}
      >
        {t(lang, "nav.saved")}
      </button>
      <button className="mobile-nav-btn" onClick={onComposeFocus}>
        {t(lang, "nav.write")}
      </button>
      <button
        className={`mobile-nav-btn ${route === "/me" ? "active" : ""}`}
        onClick={() => navigate("/me")}
      >
        {t(lang, "nav.me")}
      </button>
    </nav>
  );
}
