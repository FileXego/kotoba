---
name: Kotoba Method
description: Project health methodology for AI-assisted development. Use when the user mentions "engineering discipline", "project methodology", "code review workflow", "bug prevention", "dual oracle review", "how to structure a project", "keep project healthy as it grows", "security and simplicity balance", or needs guidance on systematic code review, test strategy, or project organization principles.
---

# Kotoba Method

A project health system that scales through discipline, not tooling. Proven across 200+ commits, 39 documented bugs, 71 integration tests, 0 npm dependencies.

---

## Five Principles

### 1. Iron Rules — declared, enforced, never bent

Define a short list of absolute prohibitions. These are your project's constitution. Examples from the reference project:

- No npm packages (Bun built-ins only)
- No image files committed
- No Zod (use TypeBox)
- No hard deletes (soft delete only)
- Verify both ends independently (backend + frontend)
- All API errors: `status(N, { success: false, error: "CODE" })`

Write them in a root `AGENTS.md` so every AI session reads them automatically. Never negotiate them.

### 2. Dual Oracle Review — two eyes catch what one misses

When a change is high-risk (security, architecture, deployment), run TWO independent oracle sessions with the same prompt, in parallel. Overlap = high confidence. Divergence = verify manually.

Single oracle misses ~50% of issues. Dual oracle catches ~90%.

**Procedure:**
```
1. Launch two fresh @oracle sessions (never resume old ones — file cache stale)
2. Same prompt for both
3. Compare outputs:
   - Both found → fix immediately (confirmed)
   - Only one found → read code yourself to verify (may be false positive)
4. Fix, then re-verify
```

### 3. Tests Follow Scars — only test what has bled

Don't write tests for coverage numbers. Write a test when a bug is found. Each test is a scar — it prevents the same wound from reopening.

**Procedure:**
```
bug discovered → write minimal repro test → fix bug → test passes → archive in PROBLEM.md → add prevention rule to AGENTS.md
```

This keeps test count proportional to actual risk. The reference project went from 0 tests to 71 — every single one tracks a real, confirmed issue.

### 4. Inward Convergence — grow without expanding

As features are added, reduce attack surface, not increase it:

- **Single entry points**: All fetch through one function (`requestJSON<T>()`). All auth through one derive. All errors through one pattern.
- **New features use existing doors**: Don't create new API prefixes, new auth mechanisms, new error formats for new features.
- **Delete as often as you add**: After every major version, grep for 0-import exports and remove them. Files created "for future use" are never used.

### 5. Periodic Cleanup — entropy is the enemy

After every significant release cycle:
```
- Find and delete dead code (0-import exports, unused files)
- consolidate resolved PROBLEM entries into AGENTS prevention rules
- Remove feature flags that never shipped
- Verify documentation matches actual code structure
```

---

## Setting Up For Any Project

### Minimum files to create:

```
PROJECT_ROOT/
├── AGENTS.md      # Commands, architecture, iron rules, prevention checklist
├── PROBLEM.md     # Indexed archive of every bug ever found
└── WORKFLOW.md    # How agents should work in this project
```

**AGENTS.md** must contain:
1. Startup commands
2. Tech stack declaration
3. Plugin/route mount order (if applicable)
4. API quick-reference table
5. Database schema
6. Iron rules (absolute constraints)
7. Prevention checklist (anti-patterns learned from bugs)

**PROBLEM.md** must contain:
1. Top-level index table with severity and fix status
2. Each entry: phenomenon → root cause → fix → prevention measure

**WORKFLOW.md** must contain:
1. Document map (what to read for what)
2. Conversation patterns (grill-me, question-first, never-guess)
3. Review method (single/dual oracle)
4. Development checklist
5. Cleanup procedures

### Test infrastructure:

Use the runtime's built-in test framework (bun:test for Bun, go test for Go, pytest for Python). No additional test libraries.

- One test file per API route group
- Helper file: `setupApp()`, `clearTables()`, `extractCookie()`
- In-memory or temp-file database per test run
- `SKIP_CAPTCHA=1`, `SKIP_RATE_LIMIT=1` test-mode flags (never in production)

---

## Security Without Dependencies

Security doesn't require frameworks. It requires:

1. **CSP header** — 4 lines in the app entry point
2. **Rate limiting** — in-memory Map, ~30 lines
3. **Production key checks** — refuse to start if defaults detected
4. **Test-mode isolation** — `SKIP_*` flags gated with `NODE_ENV !== "production"` check
5. **Path traversal guard** — block `..` in file-serving routes

---

## Growth Rules

When the project doubles in size:

1. **File count growth is ok** — if each file has a clear reason to exist
2. **Dependency growth is not ok** — defend the 0-deps boundary
3. **Test file growth follows bug count** — not ambition
4. **Security review every major version** — ask: "what new surface did we add?"
5. **If something hasn't been referenced in 2 weeks**, delete it

---

## Works with these existing skills (load when triggered):

- `tool-discipline` — before any write/edit/bash call
- `endpoint-guard` — before creating/modifying API endpoints
- `grill-me` — when designing architecture
- `bug-detective` — when debugging
- `diagnose` — for hard bugs (reproduce → minimize → fix → regression-test)
