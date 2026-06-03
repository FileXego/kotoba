import { t, type Lang, type Key } from "./i18n";

const ERR_MAP: Record<string, Key> = {
  AUTH_REQUIRED: "error.AUTH_REQUIRED",
  PARENT_NOT_FOUND: "error.PARENT_NOT_FOUND",
  MAX_DEPTH: "error.MAX_DEPTH",
  FORBIDDEN: "error.FORBIDDEN",
  INVALID_ID: "error.INVALID_ID",
  NOT_FOUND: "error.NOT_FOUND",
  DUPLICATE: "error.DUPLICATE",
  INVALID_CREDENTIALS: "error.INVALID_CREDENTIALS",
  SELF_ADMIN: "error.SELF_ADMIN",
  CAPTCHA_FAIL: "error.CAPTCHA_FAIL",
  RATE_LIMITED: "error.RATE_LIMITED",
  INVALID_PROFILE: "error.INVALID_PROFILE",
  INVALID_THEME: "error.INVALID_THEME",
  VALIDATION: "error.VALIDATION",
  INTERNAL_ERROR: "error.INTERNAL_ERROR",
};

// Parse [HTTP_NNN] CODE or [API] CODE from requestJSON error messages
export function errorKey(msg: string): string | null {
  const code = msg.split("] ")[1] || "";
  return code || null;
}

export function translateError(msg: string, lang: Lang): string {
  const code = errorKey(msg);
  return code && ERR_MAP[code] ? t(lang, ERR_MAP[code]) : msg;
}
