(function (global) {
  const THEME_KEYS = ["light", "dark", "sumi", "sakura"];
  const ROUTE_KEYS = ["home", "thread", "bookmarks", "me"];
  const THEME_ALIASES = {
    washi: "light",
    night: "dark",
  };

  const THEME_TOKENS = {
    light: {
      label: "Washi",
      bg: "#fbf4e7",
      surface: "#fffdf8",
      text: "#2f2922",
      muted: "#756956",
      border: "#dfceb1",
      accent: "#b88435",
    },
    dark: {
      label: "Night",
      bg: "#101112",
      surface: "#1e1f1f",
      text: "#f1e5cf",
      muted: "#ab9e83",
      border: "#3c3428",
      accent: "#b69a5f",
    },
    sumi: {
      label: "Sumi",
      bg: "#0d1211",
      surface: "#161c1a",
      text: "#eef2ea",
      muted: "#9aa9a2",
      border: "#2e3a35",
      accent: "#b7c3bc",
    },
    sakura: {
      label: "Sakura",
      bg: "#fbf1f2",
      surface: "#fffafb",
      text: "#342b2f",
      muted: "#927883",
      border: "#ead3d8",
      accent: "#b94f66",
    },
  };

  function normalizeThemeKey(value) {
    const raw = String(value || "").toLowerCase();
    const aliased = THEME_ALIASES[raw] || raw;
    return THEME_KEYS.includes(aliased) ? aliased : "light";
  }

  function normalizePlatform(value) {
    const raw = String(value || "").toLowerCase();
    return ["auto", "ios", "android"].includes(raw) ? raw : "auto";
  }

  function normalizeRoute(value) {
    const raw = String(value || "")
      .toLowerCase()
      .replace(/^#\/?/, "");
    return ROUTE_KEYS.includes(raw) ? raw : "home";
  }

  function initialRouteFromLocation(locationLike, searchParams) {
    const params = searchParams || new URLSearchParams(String(locationLike?.search || "").replace(/^\?/, ""));
    return normalizeRoute(params.get("route") || locationLike?.hash || "home");
  }

  function parseLabFlags(search) {
    const params = typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
    return {
      mobileWebEnabled: params.get("mobile") !== "off",
      liveApiReadOnly: params.get("api") === "live",
      dust: params.get("dust") !== "off",
      ink: params.get("ink") !== "off",
      platform: normalizePlatform(params.get("platform") || "auto"),
    };
  }

  function formalFlagsFromEnv(env) {
    const source = env || {};
    return {
      mobileWebEnabled: source.VITE_MOBILE_WEB_ENABLED === "true",
      mobileEffectsEnabled: source.VITE_MOBILE_EFFECTS_ENABLED === "true",
      mobileRoutesEnabled: source.VITE_MOBILE_ROUTES_ENABLED === "true",
    };
  }

  function apiMode(flags) {
    return flags.liveApiReadOnly ? "live-readonly" : "mock";
  }

  function canWriteToApi(flags) {
    return !flags.liveApiReadOnly;
  }

  function canUseSameOriginApi(locationLike) {
    const protocol = String(locationLike?.protocol || "").toLowerCase();
    return protocol === "http:" || protocol === "https:";
  }

  function liveApiUnavailableReason(locationLike) {
    return canUseSameOriginApi(locationLike)
      ? ""
      : "Read-only API needs localhost or deployed http(s). file:// stays in mock mode.";
  }

  function routeAfterBack(route) {
    return route === "home" ? "exit" : "home";
  }

  function nextThemeKey(current) {
    const normalized = normalizeThemeKey(current);
    const index = THEME_KEYS.indexOf(normalized);
    return THEME_KEYS[(index + 1) % THEME_KEYS.length];
  }

  function mockMessages() {
    return [
      {
        id: 1,
        name: "Akari",
        content: "Paper remembers the pressure of a brush.",
        likeCount: 12,
        bookmarked: true,
      },
      {
        id: 2,
        name: "Ren",
        content: "Replies stay close to the parent message on mobile.",
        likeCount: 5,
        bookmarked: false,
      },
      {
        id: 3,
        name: "Mika",
        content: "A quiet theme switch can become the app signature.",
        likeCount: 8,
        bookmarked: true,
      },
    ];
  }

  function mapApiMessage(item) {
    return {
      id: Number(item.id),
      name: String(item.name || "unknown"),
      content: String(item.content || ""),
      likeCount: Number(item.likeCount || 0),
      bookmarked: false,
    };
  }

  function imageTokenFromFileName(fileName) {
    const fallback = "preview-image.jpg";
    const base = String(fileName || fallback)
      .split(/[\\/]/)
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const clean = base || fallback;
    const ext = clean.split(".").pop();
    const allowed = ["png", "jpg", "jpeg", "webp"].includes(ext || "");
    return `[image:/uploads/demo-${allowed ? clean : `${clean}.jpg`}]`;
  }

  function appendToken(content, token) {
    return `${String(content || "").trim()} ${token}`.trim();
  }

  function reducedMotionPolicy(prefersReduced) {
    return {
      paperCardEntrance: !prefersReduced,
      dustBreathing: !prefersReduced,
      inkTransition: !prefersReduced,
      themeSwitchMode: prefersReduced ? "instant" : "ink",
    };
  }

  global.KotobaMobileLabCore = Object.freeze({
    THEME_KEYS,
    ROUTE_KEYS,
    THEME_TOKENS,
    normalizeThemeKey,
    normalizePlatform,
    normalizeRoute,
    initialRouteFromLocation,
    parseLabFlags,
    formalFlagsFromEnv,
    apiMode,
    canWriteToApi,
    canUseSameOriginApi,
    liveApiUnavailableReason,
    routeAfterBack,
    nextThemeKey,
    mockMessages,
    mapApiMessage,
    imageTokenFromFileName,
    appendToken,
    reducedMotionPolicy,
  });
})(globalThis);
