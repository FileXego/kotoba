import { useState, useEffect } from "react";

type Route = "/" | "/admin" | "/bookmarks";

function getRoute(): Route {
  const path = window.location.pathname;
  if (path === "/admin" || path === "/bookmarks") return path;
  return "/";
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: Route) => {
    window.history.pushState({}, "", next);
    setRoute(next);
  };

  return { route, navigate };
}
