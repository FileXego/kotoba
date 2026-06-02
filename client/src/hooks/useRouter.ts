import { useState, useEffect } from "react";
import { MOBILE_ROUTES_ENABLED } from "../flags";

type Route = "/" | "/admin" | "/bookmarks" | "/message" | "/me";

function getRoute(): Route {
  const path = window.location.pathname;
  if (path === "/admin" || path === "/bookmarks") return path;
  if (path === "/me" && MOBILE_ROUTES_ENABLED) return "/me";
  if (path.startsWith("/message/") && MOBILE_ROUTES_ENABLED) return "/message";
  return "/";
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(getRoute);
  const [messageId, setMessageId] = useState<number | null>(() => {
    if (!MOBILE_ROUTES_ENABLED) return null;
    const m = window.location.pathname.match(/^\/message\/(\d+)$/);
    return m ? Number(m[1]) : null;
  });

  useEffect(() => {
    const onPop = () => {
      setRoute(getRoute());
      if (MOBILE_ROUTES_ENABLED) {
        const m = window.location.pathname.match(/^\/message\/(\d+)$/);
        setMessageId(m ? Number(m[1]) : null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: Route, id?: number) => {
    if ((next === "/message" || next === "/me") && !MOBILE_ROUTES_ENABLED) return;
    const url = next === "/message" && id != null ? `/message/${id}` : next;
    window.history.pushState({}, "", url);
    setRoute(next);
    setMessageId(id ?? null);
  };

  return { route, navigate, messageId };
}
