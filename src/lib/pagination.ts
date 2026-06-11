export const SEARCH_MAX_LENGTH = 100;

interface PageOptions {
  defaultLimit: number;
  maxLimit: number;
}

export function normalizePagination(
  offset: number | undefined,
  limit: number | undefined,
  { defaultLimit, maxLimit }: PageOptions,
) {
  const normalizedOffset = Math.max(0, toInteger(offset, 0));
  const normalizedLimit = Math.min(maxLimit, Math.max(1, toInteger(limit, defaultLimit)));
  return { offset: normalizedOffset, limit: normalizedLimit };
}

function toInteger(value: number | undefined, fallback: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}
