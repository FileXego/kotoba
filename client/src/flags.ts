// Feature flags — all disabled by default.
// Enable explicitly via .env: VITE_MOBILE_WEB_ENABLED=true etc.
export const MOBILE_WEB_ENABLED = import.meta.env.VITE_MOBILE_WEB_ENABLED === "true";
export const MOBILE_EFFECTS_ENABLED = import.meta.env.VITE_MOBILE_EFFECTS_ENABLED === "true";
export const MOBILE_ROUTES_ENABLED = import.meta.env.VITE_MOBILE_ROUTES_ENABLED === "true";
