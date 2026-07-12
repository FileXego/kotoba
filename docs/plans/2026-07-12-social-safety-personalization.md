# Social Safety and Personalization Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Kotoba's approved safety foundation, conversation-led social graph, persistent notifications, publication-style profiles, and privacy-aware activity almanac without losing the existing editorial identity or weakening access control.

**Architecture:** Keep the Elysia monolith, SQLite, Drizzle, React, and the single requestJSON/motion/style entry points. Add one reusable SQL-first access policy, explicit relationship and safety boundaries, additive migrations, durable notifications, and content-free realtime invalidations. Deliver complete vertical slices in sequence so old application code remains compatible with every database migration.

**Tech Stack:** Bun, ElysiaJS with TypeBox, Drizzle ORM, SQLite WAL, React 19, Vite 8, Motion, self-hosted Fontsource, Bun test, and Playwright added through Bun as a governed cross-page test dependency.

---

## Execution rules

- Work only on branch codex/social-safety-personalization.
- Before every edit or command, apply tool-discipline. Before every API route change, apply endpoint-guard. Use test-driven-development for each behavior change.
- PowerShell commands never use &&. Client commands use bun run --cwd client <script>.
- Never use npm, Zod, physical deletion, post-query JavaScript permission filtering, or client-side filtering of protected realtime events.
- Preserve the user's existing README.md Cloud Monitoring change and untracked .github/workflows/project-monitor.yml. Never run git add . or git add README.md.
- Each schema change is additive and generated with bun run db:generate. Commit migration SQL, meta/_journal.json, and the generated snapshot together.
- Every task ends with its focused tests. Every vertical slice also runs bun test, client build, client lint, and a backend health smoke test.
- Source design: docs/plans/2026-07-12-social-safety-personalization-design.md.
- Canonical language: CONTEXT.md.

## Task 1: Make integration tests execute production migrations

**Files:**

- Create: testbug/migration/social-foundation.test.ts
- Create: testbug/fixtures/pre-social-0006.sql
- Modify: testbug/helpers.ts
- Modify: testbug/README.md
- Modify: PROBLEM.md
- Modify: AGENTS.md
- Modify: WORKFLOW.md

**Step 1: Write the failing migration tests**

Create a fixture representing the exact 0006 production shape with two accounts, one anonymous legacy message, one bound root, depth-one and depth-two replies, likes, and bookmarks. Add tests that:

    const sqlite = new Database(tempPath);
    loadFixture(sqlite, "testbug/fixtures/pre-social-0006.sql");
    runMigrations(sqlite);
    expect(sqlite.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(count(sqlite, "messages")).toBe(before.messages);

Also assert that a clean database has a non-empty __drizzle_migrations table and that running migrations twice changes no row counts.

**Step 2: Run the focused test and verify failure**

Run:

    bun test testbug/migration/social-foundation.test.ts

Expected: FAIL because helpers still hand-create schema and no migration fixture utilities exist.

**Step 3: Replace the handwritten test schema**

In testbug/helpers.ts:

- Export TEST_DB.
- Open the test database with bun:sqlite, enable foreign keys/WAL/busy timeout, wrap it with Drizzle, and call migrate(..., { migrationsFolder: resolve("drizzle/migrations") }).
- Remove the duplicated CREATE TABLE block.
- Make clearTables discover application tables from sqlite_master, exclude sqlite_sequence and __drizzle_migrations, disable foreign keys only for the cleanup transaction, clear tables, then re-enable and validate foreign keys.
- Export reusable runMigrations, loadFixture, and count helpers for migration tests.

**Step 4: Run migration and full backend tests**

Run:

    bun test testbug/migration/social-foundation.test.ts
    bun test

Expected: migration tests PASS and the current 92-test baseline remains green.

**Step 5: Record the repaired testing invariant**

- Add a PROBLEM.md entry: integration tests previously bypassed production migrations.
- Add a prevention rule to AGENTS.md and WORKFLOW.md: integration test databases must be built by the real migration chain; fixed historical fixtures must not be rewritten to match future schemas.
- Update testbug/README.md commands and fixture purpose.

**Step 6: Commit**

Stage only the files above and commit:

    git commit -m "test(db): run integration tests from migrations"

## Task 2: Add the additive social foundation schema and audit script

**Files:**

- Create: scripts/audit-social-db.ts
- Modify: src/db/schema.ts
- Create generated: drizzle/migrations/0007_*.sql
- Modify generated: drizzle/migrations/meta/_journal.json
- Create generated: drizzle/migrations/meta/0007_snapshot.json
- Modify: testbug/migration/social-foundation.test.ts
- Modify: testbug/helpers.ts

**Step 1: Extend the failing migration expectations**

Assert after upgrading the 0006 fixture:

- Original users/messages/likes/bookmarks counts are unchanged.
- profiles count equals users count.
- Existing messages are public, published, content version 1, and reply policy viewer.
- messages.name and nullable messages.user_id remain queryable.
- invalid legacy themes fall back only in profiles.
- root and reply audience anchors are backfilled without claiming anonymous content.
- a second migration run is idempotent.

Run the focused test and verify it fails.

**Step 2: Add schema definitions**

Extend users with nullable emailVerifiedAt while keeping avatarUrl, signature, and theme for the rollback window.

Create:

- profiles: userId primary/foreign key, displayName, avatarUrl, signature, edition, sealColor, paper, titleFace, defaultVisibility, defaultReplyPolicy, activityAudience, discoverable, externalIndexing, version, updatedAt.
- sessions: id, userId, tokenHash unique, csrfHash, createdAt, expiresAt, lastSeenAt, revokedAt, userAgent.
- follows: followerId, followedId, active, createdAt, updatedAt, unique pair, no-self CHECK.
- mutes: muterId, mutedId, active, createdAt, updatedAt, unique pair, no-self CHECK.
- blocks: blockerId, blockedId, active, createdAt, updatedAt, unique pair, no-self CHECK.

Extend messages with visibility, audienceAnchorUserId, moderationState, contentVersion, replyPolicy, clientRequestId, and indexes for feed, author/activity, and unique (userId, clientRequestId).

Keep every new field backward compatible:

    visibility: "public"
    moderationState: "published"
    contentVersion: 1
    replyPolicy: "viewer"
    clientRequestId: null
    audienceAnchorUserId: null

**Step 3: Generate and inspect migration 0007**

Run:

    bun run db:generate
    git diff -- src/db/schema.ts drizzle/migrations
    rg -n "DROP TABLE|__new_|RENAME TO|DELETE FROM" drizzle/migrations/0007_*.sql

Expected: no destructive statements.

Append additive backfill SQL to the generated migration:

- INSERT profiles SELECT one row per user.
- Use CASE to map invalid legacy theme values to light in profiles only.
- Backfill root anchors from user_id, then depth-one and depth-two anchors from ancestors.

Do not rename the generated migration.

**Step 4: Implement the privacy-safe audit script**

scripts/audit-social-db.ts accepts DB_PATH and prints only aggregate counts and checks:

    integrity
    foreignKeyViolations
    users/messages/likes/bookmarks/profiles counts
    anonymousMessages
    orphanOwnership
    orphanInteractions
    invalidThreadLinks
    migrationVersion

It must never print content, username, email, token, or raw safety signals. Exit non-zero on integrity or foreign-key failure.

**Step 5: Verify clean install, 0006 upgrade, idempotency, and audit**

Run:

    bun test testbug/migration
    bun test

Expected: all PASS.

**Step 6: Commit**

    git commit -m "feat(db): add social foundation schema"

## Task 3: Implement the central access policy and exhaustive matrix

**Files:**

- Create: src/lib/message-access.ts
- Create: testbug/unit/message-access.test.ts
- Create: testbug/integration/message-access.test.ts
- Modify: testbug/helpers.ts

**Step 1: Write the pure matrix tests**

Cover anonymous, owner, follower, current acquaintance, muted, either-direction blocked, admin-review, published, held, removed, author-deleted, public, quiet-public, acquaintance, private, garden, following, profile, thread, search, bookmarks, activity, reply, react, and mention.

The core API must be explicit rather than a single boolean:

    type Surface = "garden" | "following" | "profile" | "thread" | "search" | "bookmarks" | "activity";
    type Capability = "read" | "discover" | "reply" | "react" | "mention";

    interface AccessDecision {
      mayRead: boolean;
      mayDiscover: boolean;
      mayReply: boolean;
      mayReact: boolean;
      mayMention: boolean;
    }

    decideMessageAccess(context): AccessDecision
    buildMessageAccessPredicate(context): SQL

Assert:

- quiet public is readable by anyone with a direct/profile route but never discoverable in garden/search.
- acquaintance is based on the anchor account's current reciprocal follows.
- private is author-only.
- mute affects discovery/notifications, not confidentiality.
- block prevents discovery and interaction, while public content remains technically public to anonymous visitors.
- held is author/reviewer-only.
- ancestor intersection can only narrow.

**Step 2: Run tests and verify failure**

    bun test testbug/unit/message-access.test.ts

Expected: FAIL because message-access.ts does not exist.

**Step 3: Implement pure decisions and SQL predicates**

Use Drizzle expressions and EXISTS subqueries over follows/blocks. Keep the pure decision table and SQL builder in the same module so route authors cannot invent local variants. Export helpers for:

    visibleMessageWhere(viewer, surface)
    visibleThreadWhere(viewer, rootId)
    mayInteractWithMessage(viewer, message, capability)
    deriveAudienceAnchor(parent, authorId, requestedVisibility)

No helper may fetch all rows and filter in JavaScript.

**Step 4: Prove SQL results equal the pure matrix**

Populate accounts and messages covering every state. For each viewer/surface, compare selected IDs and counts to pure-policy expectations. Include root/depth-one/depth-two ancestor narrowing.

**Step 5: Run tests**

    bun test testbug/unit/message-access.test.ts
    bun test testbug/integration/message-access.test.ts
    bun test

Expected: PASS.

**Step 6: Commit**

    git commit -m "feat(security): centralize message access policy"

## Task 4: Retrofit every current read/write path and realtime transport

**Files:**

- Modify: src/routes/message.ts
- Modify: src/routes/bookmark.ts
- Modify: src/plugins/admin.ts
- Modify: src/lib/realtime.ts
- Modify: src/routes/events.ts
- Modify: testbug/integration/message.test.ts
- Modify: testbug/integration/bookmark.test.ts
- Modify: testbug/integration/realtime.test.ts
- Modify: testbug/integration/admin.test.ts

**Step 1: Add failing IDOR and metadata-leak tests**

Verify all of these use the same policy before count/pagination:

- garden list and search
- thread root and every reply
- parent lookup when replying
- edit, visibility change, like, bookmark
- bookmarks list and interaction ID lists
- admin review projection
- public and private SSE

Assert inaccessible resources return 404 and unauthorized rows do not affect total. Assert SSE never exposes IDs/timestamps/counts for quiet, acquaintance, private, held, or removed content.

**Step 2: Update message DTO and writes**

POST /api/message accepts:

    {
      content: string;
      parentId?: number;
      visibility: "public" | "quiet_public" | "acquaintance" | "private";
      replyPolicy?: "viewer" | "acquaintance" | "closed";
      clientRequestId: string;
    }

Behavior:

- Require userId ownership for new writing.
- Resolve current profile display name/avatar/signature for display.
- Derive audience anchor from the parent and full ancestor chain.
- Reject reply-policy or scope widening.
- Treat duplicate clientRequestId as the original success response.
- Remove username/name fallback from authorization; retain legacy name only for display.
- Increment contentVersion on content/scope edits and re-run policy.

**Step 3: Apply SQL policy before pagination/count**

Replace every local deleted-only condition in message.ts and bookmark.ts with shared access predicates. Likes/bookmarks remain compatible for this slice but cannot target unreadable content.

**Step 4: Replace content events with invalidations**

RealtimeEvent becomes:

    { audience: "public"; type: "garden.changed" }
    { audience: "user"; userId: number; type: "me.changed" | "notifications.changed" }

Only public/published top-level changes broadcast garden.changed. Private events contain no object ID, count, timestamp, author, or root ID. Emit only after the transaction commits.

**Step 5: Run focused and full tests**

    bun test testbug/integration/message.test.ts
    bun test testbug/integration/bookmark.test.ts
    bun test testbug/integration/realtime.test.ts
    bun test

Expected: PASS with no unauthorized count or event leak.

**Step 6: Smoke the backend**

Run the documented PowerShell background job and request /api/health. Expected: 200.

**Step 7: Commit**

    git commit -m "feat(security): enforce access across message surfaces"

## Task 5: Add structured client errors, routes, and visibility controls

**Files:**

- Create: client/src/types.ts
- Create: client/src/errors.ts
- Create: client/src/components/HomePage.tsx
- Create: client/src/components/VisibilityTrack.tsx
- Create: client/src/components/SafetyNotice.tsx
- Create: client/test/router.test.ts
- Create: client/test/errors.test.ts
- Modify: client/src/api.ts
- Modify: client/src/App.tsx
- Modify: client/src/hooks/useRouter.ts
- Modify: client/src/hooks/useMessageFeed.ts
- Modify: client/src/components/SubmitForm.tsx
- Modify: client/src/components/MessageCard.tsx
- Modify: client/src/components/ThreadPage.tsx
- Modify: client/src/components/MobileShell.tsx
- Modify: client/src/components/MobileBottomNav.tsx
- Delete: client/src/flags.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css
- Modify: client/src/design/motion.ts

**Step 1: Write pure client tests**

Test parseRoute/hrefForRoute for /, /bookmarks, /message/:id, /u/:username, /me/edit, /echoes, /settings/security, and /admin.

Test ApiError preserves:

    status
    code
    retryAt
    held response state

**Step 2: Implement shared types and request contract**

Move DTOs out of api.ts. ApiError must be:

    class ApiError extends Error {
      constructor(
        readonly status: number,
        readonly code: string,
        readonly retryAt?: string
      ) { super(code); }
    }

requestJSON remains the sole fetch entry, preserves 202 held, and never exposes raw server text to components.

**Step 3: Extract HomePage and make routing always real**

- App.tsx keeps shell, route dispatch, session, and invalidation coordination only.
- MobileShell always renders; CSS hides/shows navigation by breakpoint.
- Remove MOBILE_ROUTES_ENABLED and its route guards.

**Step 4: Build VisibilityTrack**

Use native radio inputs under a four-stop visual track. Export four-stop publication and three-stop profile variants. Implement ArrowLeft/Right, Home/End, aria-describedby, visible text labels, reduced motion, and 44px labels. Do not use a continuous range input.

**Step 5: Preserve the complete composer draft**

SubmitForm owns content, visibility, replyPolicy, and one crypto.randomUUID request ID. Failures preserve all fields. Success or held acceptance clears the draft and generates the next request ID. Render SafetyNotice for nudge/cooldown/held/deny.

**Step 6: Update message and thread rendering**

Show display name first and stable @username second. Ownership is userId-only. Render scope/held/reply-closed states with i18n keys. An unavailable thread uses the same not-found presentation for missing and unauthorized content.

**Step 7: Run client and full verification**

    bun test client/test
    bun run --cwd client build
    bun run --cwd client lint
    bun test

Expected: PASS.

**Step 8: Commit**

    git commit -m "feat(ui): add visibility tracks and safe drafts"

## Task 6: Replace numeric cookies with revocable server sessions and CSRF

**Files:**

- Create: src/lib/sessions.ts
- Create: src/lib/request-security.ts
- Modify: src/plugins/auth.ts
- Modify: src/plugins/rate-limiter.ts
- Modify: src/app.ts
- Modify: client/src/api.ts
- Modify: client/src/hooks/useSession.ts
- Create: testbug/integration/session-security.test.ts
- Modify: testbug/integration/auth.test.ts

**Step 1: Write failing session/security tests**

Cover:

- opaque cookie does not contain account ID
- database stores only SHA-256 token/CSRF hashes
- one-device and all-device revocation
- expiry and revoked sessions
- password/admin changes revoke or rotate
- valid legacy signed numeric cookie exchanges once
- write requests reject missing/wrong Origin or CSRF
- trusted proxy is required before X-Forwarded-For is honored
- production cookie flags

Do not set SKIP_RATE_LIMIT for the dedicated trusted-proxy tests.

**Step 2: Implement session primitives**

Use crypto.getRandomValues for at least 256 bits. Hash tokens with Web Crypto before storage. Rotate on sign-in/sign-up and sensitive account changes. Keep revoked rows for the audit/rollback window.

The browser receives:

- HttpOnly session cookie containing the opaque token.
- non-HttpOnly CSRF cookie bound by a hash in the same session.

**Step 3: Enforce write origin and CSRF**

request-security checks unsafe methods after auth:

- exact configured public origin
- Sec-Fetch-Site when present
- X-CSRF-Token equals the CSRF cookie and stored hash

requestJSON reads the CSRF cookie and adds the header. Exempt only sign-in/sign-up bootstrap endpoints and explicitly document each exemption.

**Step 4: Make proxy trust explicit**

Add TRUST_PROXY and trusted proxy addresses/CIDRs. Without configuration use the server connection address or a safe fallback, never arbitrary forwarded headers. Return Retry-After on rate responses.

**Step 5: Run tests and smoke**

    bun test testbug/integration/session-security.test.ts
    bun test testbug/integration/auth.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint

Expected: PASS and /api/health smoke returns 200.

**Step 6: Sync API/security documentation**

Update AGENTS.md, COMPAT.md, .env.example, future/DEPLOY.md, and future/ONLINE_PLAN.md for sessions, CSRF, trusted proxy, and the fact that old-code rollback may require login again.

**Step 7: Commit**

    git commit -m "feat(auth): add revocable server sessions"

## Task 7: Add explainable action safety, moderation, reporting, and appeals

**Files:**

- Create: src/lib/action-safety.ts
- Create: src/lib/action-quota.ts
- Create: src/lib/moderation.ts
- Create: src/routes/moderation.ts
- Modify: src/db/schema.ts
- Create generated: drizzle/migrations/0008_*.sql
- Modify generated: drizzle/migrations/meta/_journal.json
- Create generated: drizzle/migrations/meta/0008_snapshot.json
- Modify: src/app.ts
- Modify: src/routes/message.ts
- Modify: src/routes/upload.ts
- Modify: src/plugins/admin.ts
- Create: testbug/unit/action-safety.test.ts
- Create: testbug/integration/moderation.test.ts
- Create: testbug/integration/action-quota.test.ts

**Step 1: Write decision and state-machine tests**

Action decisions are exactly:

    "allow" | "nudge" | "cooldown" | "hold" | "deny"

Test account age, verified state, account/action/target velocity, repeated content, link count, mention count, and confirmed moderation history. Assert likes/followers/popularity are absent from inputs.

Test case states pending/claimed/resolved/cancelled/expired, claim lease, idempotent decision, contentVersion invalidation, append-only reversal, request-time expiresAt, and appeal access even when restricted.

**Step 2: Add additive governance schema**

Create moderationCases, moderationActions, and accountSafety. Use explicit nullable messageId/subjectUserId with a CHECK that exactly one primary target is set. Never use target_type plus unvalidated target_id.

Generate 0008 and stop if it rebuilds or drops core tables.

**Step 3: Implement action safety in observe/enforce modes**

SAFETY_MODE is observe or enforce. In observe mode, record aggregate decisions without changing user outcomes except existing hard banned-word/file rules. In enforce mode:

- nudge returns an actionable stable code
- cooldown returns 429 plus retry time
- hold stores content, case, and audit in one transaction and returns 202
- deny returns a stable code

If case/audit persistence fails, held content must not publish.

**Step 4: Add moderation/report/appeal routes**

Implement:

- POST /api/messages/:id/report
- GET /api/me/moderation
- POST /api/moderation/actions/:id/appeal
- GET /api/admin/moderation/cases
- PATCH /api/admin/moderation/cases/:id/claim
- PATCH /api/admin/moderation/cases/:id/resolve

Apply endpoint-guard to IDs, auth/admin, errors, SQL, and /api prefixes. Reporter identity is never returned outside authorized review.

**Step 5: Run focused/full verification**

    bun test testbug/unit/action-safety.test.ts
    bun test testbug/integration/moderation.test.ts
    bun test testbug/integration/action-quota.test.ts
    bun test

Expected: PASS.

**Step 6: Commit**

    git commit -m "feat(safety): add transparent moderation workflow"

## Task 8: Add idempotent follow, mute, block, and public profile APIs

**Files:**

- Create: src/lib/relationships.ts
- Create: src/routes/relationship.ts
- Create: src/routes/profile.ts
- Modify: src/app.ts
- Modify: src/plugins/auth.ts
- Create: testbug/integration/relationship.test.ts
- Create: testbug/integration/profile.test.ts
- Create: client/src/components/ProfilePage.tsx
- Create: client/src/components/ProfileCover.tsx
- Create: client/src/components/RelationshipControls.tsx
- Create: client/src/components/ReportPanel.tsx
- Modify: client/src/api.ts
- Modify: client/src/App.tsx
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css

**Step 1: Write relationship invariant tests**

Test explicit PUT/DELETE desired states, no self-follow/mute/block, reciprocal follow derives acquaintance, block atomically deactivates both follows, either-direction block stops follow/reply/react/mention/notifications, mute changes discovery only, and unfollow immediately revokes acquaintance content.

**Step 2: Implement relationship routes**

Implement idempotent:

- PUT/DELETE /api/users/:username/follow
- PUT/DELETE /api/users/:username/mute
- PUT/DELETE /api/users/:username/block
- GET /api/users/:username/relationship

DELETE deactivates state; it does not physically delete history. Block plus two follow deactivations occur in one SQLite transaction.

**Step 3: Implement viewer-aware profile reads**

- GET /api/profiles/:username returns profile, module-safe summary, secondary counts, and relationship state.
- Existing PATCH /api/auth/me dual-writes avatar/signature to profiles for the rollback window.
- New profile display uses current displayName; account username remains stable for URL and mention.

**Step 4: Build profile cover and relationship controls**

Add /u/:username route. Show display name, secondary @username, signature, follow/acquaintance state, and overflow actions for mute/block/report. Preserve the current editorial layout and keep counts secondary.

**Step 5: Verify both ends**

    bun test testbug/integration/relationship.test.ts
    bun test testbug/integration/profile.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint

Expected: PASS.

**Step 6: Commit**

    git commit -m "feat(social): add relationship boundaries"

## Task 9: Add chronological garden/following cursor feeds

**Files:**

- Create: src/lib/cursor.ts
- Create: src/routes/feed.ts
- Create: testbug/integration/feed.test.ts
- Create: client/src/components/FeedTabs.tsx
- Modify: client/src/components/HomePage.tsx
- Modify: client/src/hooks/useMessageFeed.ts
- Modify: client/src/components/MessageList.tsx
- Modify: client/src/api.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css

**Step 1: Write cursor and feed tests**

Use a signed/opaque cursor containing createdAt and id. Test stable descending order, no duplicates when a newer row is inserted between pages, invalid cursor 400, max limit, garden distribution, following distribution, acquaintance access, mute, block, held/removed, and exact query counts.

**Step 2: Implement cursor helpers and GET /api/feed**

Contract:

    GET /api/feed?view=garden|following&cursor=<opaque>&limit=20

Response:

    { success: true, data, nextCursor, hasMore }

Garden includes public/garden-distributed writing only. Following includes followed authors' public and quiet-public writing plus authorized acquaintance writing. Search stays in the garden/search endpoint and uses the central predicate.

**Step 3: Build tabs and dual feed state**

HomePage owns Garden/Following tablist. useMessageFeed keeps independent page state for both views, uses nextCursor rather than total/offset, and does not mix search into Following.

**Step 4: Verify**

    bun test testbug/integration/feed.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint

Expected: PASS.

**Step 5: Commit**

    git commit -m "feat(feed): add chronological following view"

## Task 10: Add mentions, durable notifications, and Echoes

**Files:**

- Create: src/lib/mentions.ts
- Create: src/lib/notifications.ts
- Create: src/routes/notification.ts
- Modify: src/db/schema.ts
- Create generated: drizzle/migrations/0009_*.sql
- Modify generated: drizzle/migrations/meta/_journal.json
- Create generated: drizzle/migrations/meta/0009_snapshot.json
- Modify: src/app.ts
- Modify: src/routes/message.ts
- Modify: src/lib/realtime.ts
- Create: testbug/unit/mentions.test.ts
- Create: testbug/integration/notification.test.ts
- Create: client/src/components/EchoesPage.tsx
- Create: client/src/components/EchoItem.tsx
- Create: client/src/hooks/useNotifications.ts
- Modify: client/src/hooks/useRealtimeEvents.ts
- Modify: client/src/components/Header.tsx
- Modify: client/src/components/MobileBottomNav.tsx
- Modify: client/src/App.tsx
- Modify: client/src/api.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css

**Step 1: Write mention/notification tests**

Cover Unicode account names supported by existing data, exact stable username lookup, editing mentions, blocked/muted recipients, duplicate reply+mention recipients, self-actions, held approval, scope narrowing, notification re-authorization, private bookmarks, and batched like summaries.

**Step 2: Add schema and generate 0009**

Create messageMentions and notifications. Notifications store references and category, never a copied content body. Add user/unread/created cursor indexes.

**Step 3: Implement durable notification service**

Insert business change and notification facts in one transaction. Emit notifications.changed only after commit. On read, join/recheck current object access and suppress stale excerpts after scope changes, deletion, or block.

Implement:

- GET /api/notifications?cursor&limit
- PATCH /api/notifications/read with explicit IDs or readThrough timestamp
- GET /api/notifications/unread-count

**Step 4: Build Echoes and realtime refresh**

Realtime client types shrink to garden.changed, me.changed, notifications.changed, ready, ping, and sync.tick. Echoes groups reply, mention, follow/acquaintance, like summary, and governance items. Mobile nav has five columns and a restrained accessible cinnabar unread marker.

**Step 5: Verify**

    bun test testbug/unit/mentions.test.ts
    bun test testbug/integration/notification.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint

Expected: PASS.

**Step 6: Commit**

    git commit -m "feat(notifications): add mentions and echoes"

## Task 11: Add profile modules, selected writing, and controlled editor

**Files:**

- Modify: src/db/schema.ts
- Create generated: drizzle/migrations/0010_*.sql
- Modify generated: drizzle/migrations/meta/_journal.json
- Create generated: drizzle/migrations/meta/0010_snapshot.json
- Modify: src/routes/profile.ts
- Create: testbug/integration/profile-editor.test.ts
- Create: client/src/components/ProfilePublication.tsx
- Create: client/src/components/ProfileEditorPage.tsx
- Create: client/src/components/ProfileModuleEditor.tsx
- Create: client/src/theme/profileAppearance.ts
- Create: client/test/profile-draft.test.ts
- Modify: client/src/components/ProfilePage.tsx
- Modify: client/src/components/Avatar.tsx
- Modify: client/src/hooks/useTheme.ts
- Modify: client/src/App.tsx
- Modify: client/src/api.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css
- Delete after replacement: client/src/components/MePage.tsx

**Step 1: Write schema/API/editor tests**

Test one row per fixed module, unique order, allowlisted module keys, public/acquaintance/self visibility, batch save transaction, optimistic version conflict, pin authorization, maximum pin count, preview filtering, and separation between global reading theme and public profile appearance.

**Step 2: Add module/pin schema and migration 0010**

Create profileModules and profilePins. Store visibility/order/enabled as structured columns, not permission-bearing JSON. Backfill default Cover, Selected, Activity, Notes, and Shelf modules.

**Step 3: Implement batch profile API**

PATCH /api/profile accepts profile fields plus the complete fixed module list and expected version. Validate allowlisted edition/seal/paper/titleFace values. Save atomically and return 409 PROFILE_VERSION_CONFLICT on stale drafts.

Add idempotent pin PUT/DELETE endpoints. Continue dual-writing avatar/signature to users during the rollback window.

**Step 4: Build one shared publication renderer**

ProfilePublication renders both public profile and editor preview. Scope author appearance under:

    .profile-publication[data-edition][data-seal][data-paper][data-title-face]

Never mutate html[data-theme] from a visited profile.

**Step 5: Build editor and preview**

ProfileEditorPage groups Appearance, Presentation, Footprint, Boundaries, and Discovery. Module editor supports drag plus keyboard move-up/down. Save explicitly once. Preview as public/acquaintance/self. Replace MePage only after all existing avatar/signature/theme/sign-out behavior has migrated.

**Step 6: Verify**

    bun test testbug/integration/profile-editor.test.ts
    bun test client/test/profile-draft.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint

Expected: PASS.

**Step 7: Commit**

    git commit -m "feat(profile): add publication-style editor"

## Task 12: Add curated shelves without exposing private bookmarks

**Files:**

- Modify: src/db/schema.ts
- Create generated: drizzle/migrations/0011_*.sql
- Modify generated: drizzle/migrations/meta/_journal.json
- Create generated: drizzle/migrations/meta/0011_snapshot.json
- Create: src/routes/collection.ts
- Modify: src/app.ts
- Create: testbug/integration/collection.test.ts
- Create: client/src/components/ProfileShelf.tsx
- Create: client/src/components/CollectionEditor.tsx
- Modify: client/src/components/ProfilePublication.tsx
- Modify: client/src/api.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css

**Step 1: Write privacy and ownership tests**

Test collection ownership, title/description limits, structured audience, item ordering, inaccessible item omission, scope narrowing, block effects, and proof that bookmarks are never copied or exposed automatically.

**Step 2: Add collections schema and routes**

Create collections and collectionItems with soft active state, explicit ordering, and audience. Implement CRUD-like state changes using PATCH/PUT and deactivation, not physical deletion.

**Step 3: Build shelf and editor**

Render only explicitly curated collections through ProfilePublication. Provide reorder controls and privacy preview. Reuse existing message DTO/access policy.

**Step 4: Verify and commit**

    bun test testbug/integration/collection.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint
    git commit -m "feat(profile): add curated shelves"

## Task 13: Add viewer-aware activity almanac and gentle notes

**Files:**

- Create: src/routes/activity.ts
- Modify: src/app.ts
- Create: testbug/integration/activity.test.ts
- Create: client/src/activity.ts
- Create: client/src/components/ActivityAlmanac.tsx
- Create: client/src/components/ProfileNotes.tsx
- Create: client/test/activity.test.ts
- Modify: client/src/components/ProfilePublication.tsx
- Modify: client/src/api.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css

**Step 1: Write backend and pure calendar tests**

Cover anonymous/acquaintance/owner visibility, private exclusion, held/removed/deleted exclusion, leap years, timezone boundaries, empty years, writing/reply filters, muted/blocked relationships, and exact daily totals.

Pure client tests must prove:

- every date in 365/366-day years is represented
- 52x7 is the main grid and 1–2 year-remainder cells contain the surplus days
- four 13x7 mobile seasons plus year remainder preserve all dates
- density levels are stable and zero is neutral

**Step 2: Implement SQL aggregation**

GET /api/profiles/:username/activity?year=YYYY&type=all|writing|reply applies the central viewer predicate before GROUP BY date. Return authorized daily counts and gentle aggregate notes only. Do not create activity/event or daily-summary tables.

**Step 3: Build almanac and notes**

Desktop renders the 52x7 main grid plus year remainder. Mobile renders four seasonal segments plus remainder. Every cell has date/count accessible text and keyboard focus; dense data cells need not be 44px, but all controls and details buttons do.

Do not animate hundreds of cells individually. Today uses a small seal; no streak, failure red, rank, or productivity language.

**Step 4: Verify and commit**

    bun test testbug/integration/activity.test.ts
    bun test client/test/activity.test.ts
    bun test
    bun run --cwd client build
    bun run --cwd client lint
    git commit -m "feat(profile): add private activity almanac"

## Task 14: Complete account security, moderation, reporting, and appeal UI

**Files:**

- Create: client/src/components/AccountSecurityPage.tsx
- Create: client/src/components/SessionList.tsx
- Create: client/src/components/ModerationReview.tsx
- Create: client/src/components/ModerationCaseDetail.tsx
- Create: client/src/components/AppealPanel.tsx
- Modify: client/src/components/AdminPanel.tsx
- Modify: client/src/components/EchoesPage.tsx
- Modify: client/src/components/MessageCard.tsx
- Modify: client/src/components/SafetyNotice.tsx
- Modify: client/src/components/ReportPanel.tsx
- Modify: client/src/App.tsx
- Modify: client/src/api.ts
- Modify: client/src/i18n.ts
- Modify: client/src/styles.css
- Modify: client/src/design/motion.ts

**Step 1: Add failing API-state mapping tests**

Test held, nudge, cooldown, deny, reason category, retry time, appeal link, expired restriction, session revoke, report success, and unavailable stale notification. Ensure draft values survive every failure.

**Step 2: Build security settings**

Show current sessions with device label, created/last-used/expiry, revoke one, and revoke all others. Do not display raw IP, token, or risk signal.

**Step 3: Build moderation review**

Admin UI exposes pending/claimed/resolved/cancelled/expired, content version, reason, duration, evidence reference, claim lease, approve/deny/restrict/reverse. Avoid decorative labels that obscure actual governance meaning.

**Step 4: Build user reporting and appeal flows**

ReportPanel keeps reporter private and offers hide/mute/block after success. Governance items in Echoes open AppealPanel tied to the real action/version. SafetyNotice remains an inline editorial note, not a blocking modal.

**Step 5: Verify and commit**

    bun test
    bun run --cwd client build
    bun run --cwd client lint
    git commit -m "feat(safety): add review and appeal interfaces"

## Task 15: Add reproducible cross-page Playwright coverage

**Files:**

- Modify: client/package.json
- Modify generated: client/bun.lock
- Create: client/playwright.config.ts
- Create: client/e2e/visibility-track.spec.ts
- Create: client/e2e/feeds-echoes.spec.ts
- Create: client/e2e/profile-publication.spec.ts
- Create: client/e2e/activity-almanac.spec.ts
- Create: client/e2e/mobile-navigation.spec.ts
- Modify: client/README.md
- Modify: README.md using an index-only patch that excludes the user's Cloud Monitoring hunk

**Step 1: Add Playwright through Bun**

Run:

    bun add --cwd client -d @playwright/test

Record Apache-2.0, cross-page responsibility, and graceful fallback/manual command in client/README.md and README.md. Do not add any single-component UI library.

**Step 2: Configure deterministic E2E**

The config starts backend and Vite with an explicit temporary TEST_DB/DB_PATH, SKIP_CAPTCHA only in test, and never SKIP_RATE_LIMIT for dedicated security specs. Capture trace/screenshot only on failure.

**Step 3: Cover critical flows**

Tests cover:

- four/three-stop tracks with click, arrows, Home/End, descriptions, and 44px hit areas
- failed submission preserving content/scope/reply policy/request ID
- garden/following cursor without duplicates
- Echoes refresh and safe stale-notification fallback
- public/acquaintance/self profile preview
- 365/366 date completeness and year remainder
- 375, 390, 430, 768, 1024, 1440 layouts
- four themes and prefers-reduced-motion
- five-item mobile nav with no overflow

**Step 4: Run**

    bun test client/test
    bun run --cwd client build
    bun run --cwd client lint
    bun run --cwd client test:e2e

Expected: PASS.

**Step 5: Stage README safely and commit**

Generate an index-only patch for the social/E2E documentation hunk. Never stage the pre-existing Cloud Monitoring hunk or .github/workflows/project-monitor.yml.

    git commit -m "test(ui): add cross-page social flows"

## Task 16: Harden deployment, synchronize docs, and run final acceptance

**Files:**

- Modify: future/deploy.sh
- Modify: future/backup.sh
- Modify: COMPAT.md
- Modify: future/DEPLOY.md
- Modify: future/ONLINE_PLAN.md
- Modify: LONGTODO.md
- Modify: future/NATIVE_APP_ROADMAP.md
- Modify: AGENTS.md
- Modify: WORKFLOW.md
- Modify: DOCMAP.md
- Modify: .env.example
- Modify: README.md using index-only staging
- Modify: package.json

**Step 1: Fix deployment order**

Deployment becomes:

1. Prepare/install/test/build the new release without touching production DB.
2. Run scripts/audit-social-db.ts before migration.
3. Create SQLite .backup and integrity-check the backup.
4. Stop the service briefly so the old app cannot write during migration.
5. Run migrations against shared DB_PATH.
6. Run post-migration audit; on failure restart old app without switching release.
7. Switch symlink, start new version, require both systemctl active and /api/health 200.
8. On new-app failure switch application code back; database restore remains a separate stopped-service disaster-recovery procedure.

Add bash -n checks for deploy/backup scripts.

**Step 2: Make migration drift a CI/local gate**

Add scripts that use an explicit temporary DB_PATH, run clean migration, 0006 upgrade, idempotency, audit, tests, build/lint, and backend /api/health. After db:generate, fail if schema/migration diff is uncommitted.

**Step 3: Synchronize the document map**

Per DOCMAP:

- AGENTS.md: plugin order, API table, schema, commands, prevention rules.
- WORKFLOW.md: current version and migration/test workflow.
- LONGTODO.md and future/NATIVE_APP_ROADMAP.md: assign this Web social/security release a unique version before the existing iOS 2.2.0 milestone.
- COMPAT.md/future DEPLOY/ONLINE_PLAN: additive rollback versus data restore, new env vars, current test count.
- README.md: features, architecture, design, security, API, governed Playwright dependency.

Preserve the user's README and workflow changes; stage only our README hunks.

**Step 4: Run the complete acceptance matrix**

Run:

    bun test
    bun run --cwd client build
    bun run --cwd client lint
    bun run --cwd client test:e2e
    bun test testbug/migration
    bash -n future/deploy.sh
    bash -n future/backup.sh

Run the PowerShell backend job and require /api/health 200.

Then verify:

- clean install, 0006 upgrade, migration idempotency, backup restore
- old-code-compatible projection after every additive migration
- complete access matrix, IDOR, search/count/page/SSE no-leak
- sessions, CSRF, revocation, trusted proxy, limits with no skip
- relationship and review-claim concurrency
- all themes/viewports/keyboard/reduced motion
- no zero-reference exports or stale MOBILE_ROUTES_ENABLED paths

**Step 5: Perform two independent security reviews**

Start two fresh review sessions from the final file snapshot with the same prompt. Compare results, then personally re-read every reported location. Fix confirmed findings and rerun the entire matrix.

**Step 6: Final commit**

Stage only project changes owned by this feature and commit:

    git commit -m "docs(release): complete social safety rollout"

Do not push unless explicitly requested.
