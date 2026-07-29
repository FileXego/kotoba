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
   import { setupApp, extractCookie } from "../helpers";
   ```
3. Use `beforeAll` → `setupApp()`, `afterAll` → `cleanup()`
4. Use the returned `app` instance, then `app.handle(req)` to fire requests
5. Assert on `res.status` and `res.json()` data

## Test DB isolation

- A process-specific root is created under the OS temp directory (`kotoba-test-<pid>-*`)
- SQLite and managed uploads live under that root, never inside the repository
- The SQLite schema is created by the same committed Drizzle migration chain used in production
- `clearTables()` wipes all data between suites — each `setupApp()` call starts clean
- The temp root is removed on normal process exit; the OS can reclaim it after abnormal worker termination
- The default integration helper uses `SKIP_CAPTCHA=1` and `SKIP_RATE_LIMIT=1`; the rate-limit suite starts separate processes with the real gates enabled

## Layer structure

```
testbug/
  helpers.ts                # setupApp, cleanup, extractCookie
  README.md
  integration/              # full-stack integration tests (auth, messages, etc.)
  migration/                # real migration/backfill behavior
  release/                  # CI and deployment script gates
  unit/                     # isolated guards/configuration
```

## Known limitations

- **No external calls**: `SKIP_CAPTCHA=1` eliminates Cloudflare Turnstile network calls. Tests run fully offline.
- **Rate-limit isolation**: most integration suites disable the in-memory limiter; `integration/rate-limiter.test.ts` starts isolated processes with real rate-limit and production bot-gate behavior enabled.
- **Shared DB per worker**: suites in one worker share one migrated SQLite file. `clearTables()` ensures no cross-suite data leak.
- **Release privilege/state gates**: release tests assert that lifecycle scripts cannot write reviewed source/root templates, dist contains no special-file escape path, cron read errors do not overwrite schedules, and only systemd's exact inactive state permits destructive work.
- **Explicit shell fixtures**: Bash embedded in `String.raw` uses raw-string escaping, and mutation-based rejection tests must prove the mutation occurred. Tests that cross `run_root` stub both `sudo` and the privileged command, including exact systemd exit codes; they never rely on a command being absent from the developer machine.
- **Linux boundary**: release Bash is exercised locally through Git Bash, but GitHub Ubuntu CI remains the final tag gate because MSYS argument handling and host command availability differ. Neither environment replaces Ubuntu staging checks for owner/mode, real systemd/nginx/locks, and a complete restore drill.
