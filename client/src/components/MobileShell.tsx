import { MOBILE_ROUTES_ENABLED } from "../flags";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function MobileShell({ children, className }: Props) {
  if (!MOBILE_ROUTES_ENABLED) return <>{children}</>;
  return <div className={`mobile-shell ${className || ""}`}>{children}</div>;
}
