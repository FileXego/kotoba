import { MOBILE_ROUTES_ENABLED } from "../flags";
import { t, type Lang } from "../i18n";
import type { Route } from "../hooks/useRouter";

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
        type="button"
        className={`mobile-nav-btn ${route === "/" ? "active" : ""}`}
        aria-current={route === "/" ? "page" : undefined}
        onClick={() => navigate("/")}
      >
        <span className="mobile-nav-folio" aria-hidden="true">{t(lang, "editorial.navHomeMark")}</span>
        <span className="mobile-nav-label">{t(lang, "nav.home")}</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-btn ${route === "/bookmarks" ? "active" : ""}`}
        aria-current={route === "/bookmarks" ? "page" : undefined}
        onClick={() => navigate("/bookmarks")}
      >
        <span className="mobile-nav-folio" aria-hidden="true">{t(lang, "editorial.navSavedMark")}</span>
        <span className="mobile-nav-label">{t(lang, "nav.saved")}</span>
      </button>
      <button type="button" className="mobile-nav-btn mobile-nav-compose" onClick={onComposeFocus}>
        <span className="mobile-nav-folio" aria-hidden="true">{t(lang, "editorial.navWriteMark")}</span>
        <span className="mobile-nav-label">{t(lang, "nav.write")}</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-btn ${route === "/me" ? "active" : ""}`}
        aria-current={route === "/me" ? "page" : undefined}
        onClick={() => navigate("/me")}
      >
        <span className="mobile-nav-folio" aria-hidden="true">{t(lang, "editorial.navMeMark")}</span>
        <span className="mobile-nav-label">{t(lang, "nav.me")}</span>
      </button>
    </nav>
  );
}
