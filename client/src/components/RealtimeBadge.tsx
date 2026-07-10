import { t, type Lang } from "../i18n";
import type { RealtimeStatus } from "../hooks/useRealtimeEvents";

interface Props {
  lang: Lang;
  status: RealtimeStatus;
}

const LABEL_KEY: Record<RealtimeStatus, "realtime.connecting" | "realtime.live" | "realtime.offline" | "realtime.unsupported"> = {
  connecting: "realtime.connecting",
  live: "realtime.live",
  offline: "realtime.offline",
  unsupported: "realtime.unsupported",
};

export function RealtimeBadge({ lang, status }: Props) {
  return (
    <div className={`realtime-badge realtime-${status}`} data-state={status} aria-live="polite">
      <span className="realtime-dot" aria-hidden="true" />
      <span className="realtime-label">{t(lang, LABEL_KEY[status])}</span>
    </div>
  );
}

