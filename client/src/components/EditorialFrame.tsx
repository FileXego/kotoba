import { t, type Key, type Lang } from "../i18n";
import type { RealtimeStatus } from "../hooks/useRealtimeEvents";
import type { Route } from "../hooks/useRouter";
import { RealtimeBadge } from "./RealtimeBadge";

const ROUTE_META: Record<Route, { folio: string; label: Key }> = {
  "/": { folio: "01", label: "nav.home" },
  "/bookmarks": { folio: "02", label: "bookmarks.title" },
  "/message": { folio: "03", label: "thread.title" },
  "/me": { folio: "04", label: "me.title" },
  "/admin": { folio: "05", label: "admin.title" },
};

interface Props {
  children: React.ReactNode;
  lang: Lang;
  route: Route;
  realtimeStatus: RealtimeStatus;
}
export function EditorialFrame({ children, lang, route, realtimeStatus }: Props) {
  const meta = ROUTE_META[route];
  const date = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="editorial-frame">
      <aside className="folio-rail" aria-label={t(lang, "editorial.folio")}>
        <div className="folio-brand">
          <span className="folio-kicker">{t(lang, "editorial.kicker")}</span>
          <span className="folio-rule" aria-hidden="true" />
          <span className="folio-number">{meta.folio}</span>
        </div>
        <div className="folio-meta">
          <span>{t(lang, meta.label)}</span>
          <span>{date}</span>
          <RealtimeBadge lang={lang} status={realtimeStatus} />
        </div>
        <span className="folio-seal" aria-hidden="true">{t(lang, "editorial.seal")}</span>
      </aside>

      <div className="mobile-folio" aria-hidden="true">
        <span>{meta.folio}</span>
        <span>{t(lang, meta.label)}</span>
        <span>{date}</span>
      </div>

      <main className="app">{children}</main>
      <div className="editorial-balance" aria-hidden="true" />
    </div>
  );
}
