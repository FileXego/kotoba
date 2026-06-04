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

- A single shared SQLite DB is created before any tests run (`testbug/.test-<timestamp>.db`)
- `clearTables()` wipes all data between suites — each `setupApp()` call starts clean
- The DB file is deleted via `process.on("exit")` hook when the test process ends
- `SKIP_CAPTCHA=1` and `SKIP_RATE_LIMIT=1` eliminate external dependencies and rate limits during testing

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

- **No external calls**: `SKIP_CAPTCHA=1` eliminates Cloudflare Turnstile network calls. Tests run fully offline.
- **No rate limits**: `SKIP_RATE_LIMIT=1` disables the in-memory rate limiter during tests.
- **Shared DB**: all test suites share one SQLite file. `clearTables()` ensures no cross-suite data leak.
