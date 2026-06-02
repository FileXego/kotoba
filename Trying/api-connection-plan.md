# Frontend and backend API connection plan

> 按你的要求：先列如何写，再实现。本文只规划方案，不改现有 `src/` 或 `client/src/`。

## Goal

Make frontend/backend API connections maintainable as routes grow:

- Keep one fetch wrapper.
- Keep typed resource functions.
- Keep backend error codes machine-readable.
- Keep cookie auth for Web.
- Leave room for mobile token auth later.

## Current pattern

Frontend:

- `client/src/api.ts`
- `BASE = "/api"`
- `requestJSON<T>(url, init)`
- functions such as `fetchMessages`, `submitMessage`, `toggleLike`

Backend:

- Elysia plugins and routes under `/api`
- `auth` derives `currentUser`
- routes return `{ success: true, ... }` or `status(N, { success: false, error: "CODE" })`

This is a good base. Do not replace it with a generated client yet.

## Recommended API layering

```text
React component
  ↓ calls
feature hook
  ↓ calls
api.ts resource function
  ↓ calls
requestJSON<T>()
  ↓ fetch
Elysia /api route
  ↓ Drizzle
SQLite
```

Example:

```text
BookmarksPage
  → useBookmarks()
  → fetchBookmarks({ offset, limit })
  → requestJSON<MessagesResponse>("/api/bookmarks?...") 
  → GET /api/bookmarks
  → bookmarks join messages/users
```

## Step 1: keep requestJSON as the only fetch gateway

Rules:

- No component calls `fetch` directly.
- No hook calls `fetch` directly.
- Every API function returns typed data or throws.
- Error messages keep `[HTTP_NNN]` / `[API]` prefix.

Potential small improvement:

```ts
async function requestJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`[HTTP_${res.status}] ${data.error || ""}`);
  if (data.success === false) throw new Error(`[API] ${data.error || "unknown"}`);
  return data as T;
}
```

Keep this shape. Only add optional helpers around query params.

## Step 2: group API functions by resource

Keep one file for now, but add sections:

```ts
// Messages
fetchMessages
fetchReplies
submitMessage
updateMessage

// Interactions
toggleLike
toggleBookmark
fetchInteractions

// Bookmarks
fetchBookmarks

// Profile
updateMe
uploadAvatar

// Auth
signUp
signIn
signOut
fetchMe

// Admin
adminFetchMessages
adminRestoreMessage
adminFetchUsers
adminToggleAdmin
```

Split into `client/src/api/*.ts` only when `api.ts` becomes hard to scan.

## Step 3: add feature hooks

Do not put loading/error/pagination state directly into every page component.

Suggested hooks:

```text
useAuth()
useMessages()
useBookmarks()
useInteractions()
useTheme()
```

Example shape:

```ts
function useBookmarks(user: User | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchBookmarks({ offset, limit: PAGE_SIZE });
      setMessages((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "LOAD_FAIL");
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { messages, total, loading, error, load };
}
```

## Step 4: backend route additions

For 2.1:

```text
PATCH /api/auth/me
PATCH /api/auth/avatar
GET /api/bookmarks
```

Rules:

- All new routes use `/api`.
- All mutation routes check `currentUser`.
- All params converted with `Number(...)` must guard `isNaN`.
- All errors use machine codes.
- Query `limit` has max 50.

## Step 5: response typing

Keep response names stable:

```ts
interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface Paginated<T> {
  success: true;
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

interface ApiFailure {
  success: false;
  error: string;
}
```

Do not expose these everywhere if it makes code noisy. Use them where they reduce duplication.

## Step 6: Web cookie auth

Web keeps signed cookie session.

Frontend calls:

- same-origin `/api/*`
- no manual token
- no localStorage auth token

Vite proxy remains:

```ts
server: {
  proxy: {
    "/api": "http://localhost:3000",
  },
}
```

## Step 7: mobile token auth later

Do not mix mobile token into Web state.

Future mobile requests:

```http
Authorization: Bearer <token>
X-Kotoba-Client: ios
X-Kotoba-Version: 1.0.0
```

Backend auth derive can check:

1. Cookie session first for Web.
2. Bearer token for App.

Do not break existing cookie flow.

## Step 8: implementation order

Recommended order when actually coding:

1. Extend schema and migrations.
2. Extend `lookupUser`.
3. Add profile API.
4. Add bookmarks API.
5. Extend `api.ts`.
6. Add hooks.
7. Add pages/components.
8. Verify backend smoke.
9. Verify frontend build.

## Do not do yet

- Do not introduce React Query.
- Do not introduce Eden Treaty yet.
- Do not split api files before growth requires it.
- Do not introduce mobile token auth before App work starts.
- Do not bypass `requestJSON<T>()`.
