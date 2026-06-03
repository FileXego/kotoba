# testbug — Integration & Regression Tests

## Run

```powershell
# From project root:
bun test
```

To run only auth tests:

```powershell
bun test testbug/integration/auth.test.ts
```

## Add a new test file

1. Create `testbug/<layer>/<name>.test.ts`
2. Import helpers from `../helpers`:
   ```ts
   import { setupApp, getApp, cleanup } from "../helpers";
   ```
3. Use `beforeAll` → `setupApp()`, `afterAll` → `cleanup()`
4. Use `getApp()` to get the Elysia instance, then `app.handle(req)` to fire requests
5. Assert on `res.status` and `res.json()` data

## Test DB isolation

- Each `setupApp()` call creates a temp SQLite DB at `testbug/.test-<timestamp>.db`
- `TEST_DB` env var is set **before** any app imports so `src/db/index.ts` picks it up
- The DB file is deleted in `cleanup()`
- Tests sharing a `describe` block share the same DB; use separate `describe` blocks for logically separate test suites

## Layer structure

```
testbug/
  helpers.ts                # setupApp, getApp, cleanup, extractCookie
  README.md
  integration/              # full-stack integration tests (auth, messages, etc.)
  regression/               # regression tests for past bugs (TODO)
  stress/                   # stress / concurrency tests (TODO)
```

## Known limitations

- **Rate limiter**: the in-memory rate limiter in `src/plugins/rate-limiter.ts` is shared across test suites that run within the same minute. Keep sign-up tests within 3 per suite, or use distinct `x-forwarded-for` headers.
- **Turnstile CAPTCHA**: tests that sign up call Cloudflare's Turnstile API. Offline runs will get `CAPTCHA_FAIL` (429). Set `TURNSTILE_SECRET` to the Cloudflare testing key (`1x0000000000000000000000000000000AA`) — this is the default.
- **Cookie secret**: set to `"test-secret"` in helpers. The auth plugin uses `import.meta.env.COOKIE_SECRET` (read at module load time).
