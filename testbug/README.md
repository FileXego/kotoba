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

To verify the production migration chain and historical upgrade fixture:

```powershell
bun test testbug/migration/social-foundation.test.ts
```

## Add a new test file

1. Create `testbug/<layer>/<name>.test.ts`
2. Import helpers from `../helpers`:
   ```ts
   import { setupApp, extractCookie } from "../helpers";
   ```
3. Use `beforeAll` → `setupApp()`, `afterAll` → `cleanup()`
4. Use the returned `app` instance, then `app.handle(req)` to fire requests
5. Assert on `res.status` and `res.json()` data

## Test DB isolation

- A single shared SQLite DB is created per test process (`testbug/.test-<pid>-<timestamp>.db`)
- The shared DB is built by the real `drizzle/migrations` chain; tests do not maintain a second handwritten schema
- `clearTables()` discovers migrated application tables and wipes them between suites — each `setupApp()` call starts clean
- The DB file is deleted via `process.on("exit")` hook when the test process ends
- `SKIP_CAPTCHA=1` and `SKIP_RATE_LIMIT=1` eliminate external dependencies and rate limits during testing

## Historical migration fixtures

- `fixtures/pre-social-0006.sql` is a closed production-era snapshot used to prove that later migrations preserve legacy users, anonymous messages, reply trees, likes, and bookmarks.
- A historical fixture is immutable after it lands. Add a newer fixture when a new compatibility boundary is needed; do not rewrite the old one to match the latest schema.
- Migration tests must cover upgrade integrity, foreign keys, data counts, repeat execution, and a readable closed backup.

## Layer structure

```
testbug/
  helpers.ts                # setupApp, cleanup, extractCookie
  README.md
  fixtures/                 # immutable historical database snapshots
  integration/              # full-stack integration tests (auth, messages, etc.)
  migration/                # production-chain and upgrade regression tests
  unit/                     # pure policy and decision matrices
  regression/               # regression tests for past bugs (TODO)
  stress/                   # stress / concurrency tests (TODO)
```

## Known limitations

- **No external calls**: `SKIP_CAPTCHA=1` eliminates Cloudflare Turnstile network calls. Tests run fully offline.
- **No rate limits**: `SKIP_RATE_LIMIT=1` disables the in-memory rate limiter during tests.
- **Shared DB**: all test suites share one SQLite file. `clearTables()` ensures no cross-suite data leak.
- **Fixture scope**: historical fixtures intentionally contain only representative compatibility data, not a production dump.
