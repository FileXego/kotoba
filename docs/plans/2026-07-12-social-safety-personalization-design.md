# Kotoba Social Safety and Personalization Design

> Status: Approved for implementation
> Date: 2026-07-12
> Canonical domain language: [`CONTEXT.md`](../../CONTEXT.md)

## Objective

Evolve Kotoba into a mature, conversation-led social system whose safety is normally unobtrusive, whose actual restrictions are transparent and reversible, and whose personal pages feel like individually edited publications rather than programmer dashboards.

## Confirmed product direction

- Kotoba is a **public courtyard with lightweight following**: the chronological public garden remains, while following adds a personal reading lens.
- Mutual following dynamically forms an **acquaintance** relationship.
- Publication scope is public, quiet public, acquaintance-visible, or private; replies may only inherit or narrow their ancestor audience.
- Mute provides personal quiet; block establishes a two-way interaction boundary.
- Safety follows `allow → nudge → cooldown → hold → deny`; internal signals stay private, but actual restrictions require reasons, duration, recovery guidance, and appeal.
- Personal pages are controlled private publications composed from cover, selected writing, activity almanac, gentle statistics, and curated shelves.
- The first social scope is conversation-led: following, mentions, replies, notifications, reporting, mute, and block; no reposts, quote-posts, direct messages, trending lists, recommendation ranking, or follower competition.

## Delivery strategy

Use a **safety foundation plus vertical slices**:

1. Shared access, relationship, action-safety, moderation, and session foundations.
2. Relationships, personal boundaries, and their complete API/UI flows.
3. Public garden, following feed, mentions, and persistent notifications.
4. Publication-style profiles, modules, and controlled appearance.
5. Viewer-aware activity almanac and gentle statistics.

Every slice includes schema, backend, frontend, tests, migrations, and documentation before the next slice begins.

## 1. System boundaries and request flow — approved

Keep the existing Elysia monolith, SQLite database, and React client. Do not introduce microservices, Redis, CQRS, event sourcing, a generic repository layer, or a rule DSL.

The backend gains four small internal boundaries:

- **Access policy** separately answers whether content may be read, discovered on a surface, or interacted with, and produces reusable SQL predicates.
- **Relationships** owns follow, mute, and block invariants. Acquaintance is derived from current reciprocal follows and the absence of a block; it is not stored separately.
- **Safety decision** evaluates a concrete action with its actor, target, content, and cost, returning allow, nudge, cooldown, hold, or deny. It is not a context-free global middleware.
- **Moderation** owns review cases, reasons, durations, appeals, and append-only actions.

### Read path

`request → authentication → access predicate → SQL filtering → count/order/page/aggregate → DTO`

Access filtering must happen in SQL before counting, sorting, pagination, search, or aggregation. The same predicate covers garden, following feed, threads, search, bookmarks, profiles, notifications, activity almanac, and later read surfaces. Invisible resources return a non-enumerating not-found response to ordinary viewers.

### Write path

`validation and authentication → target access and block checks → account/IP/target action quota → safety decision → one SQLite transaction → post-commit notification/invalidation`

No failed write may leave a partial relationship, moderation record, notification, or realtime event. Editing content or widening distribution is treated as a new publication decision and is checked again.

### Visibility model

The four user-facing scopes map to two internal concerns:

- **Audience**: public, the current acquaintances anchored to an account, or the author only.
- **Distribution**: public garden/search/discovery, following/profile only, or no public distribution.

Replies inherit the parent audience anchor. Their effective audience is the intersection of their own setting with the complete ancestor chain. Narrowing or holding an ancestor immediately narrows the whole branch; widening an ancestor never automatically widens another author's reply.

### Realtime boundary

Realtime events become content-free invalidation signals:

- Only published public content may broadcast `garden.changed`.
- The current account and notification recipients receive targeted `me.changed` or `notifications.changed`.
- Clients refetch through protected APIs after an invalidation.
- Non-public or held content never broadcasts its ID, count, timestamp, or existence.

Following and acquaintance feeds do not use in-memory ACL fan-out in the first release; focus refresh and the existing polling fallback remain sufficient.

## 2. Data model and migration — approved

Create a table only when a concept has its own lifecycle or constraints.

### Account and profile

- `users` remains the private account core: stable username, email, password hash, admin state, and timestamps.
- `sessions` stores hashed opaque session tokens, expiry, revocation, and device activity so individual devices can be revoked.
- `profiles` is a one-to-one public presentation record with display name, avatar, signature, controlled appearance tokens, and defaults.
- `profile_modules` stores fixed module type, order, enabled state, and structured module visibility. Module visibility is public, acquaintance, or self; quiet public is a publication-distribution concept and does not apply here.
- `profile_pins` stores intentionally selected writing. `collections` and `collection_items` are added with the shelf slice and never mirror private bookmarks automatically.

Normal UI resolves the current display name and avatar through the profile. The existing `messages.name` remains only as a legacy authorship snapshot and never participates in authorization. New writing must belong to a stable account ID.

### Relationships and communication

- `follows`, `mutes`, and `blocks` remain separate because their direction, invariants, and query behavior differ.
- The active state is preserved rather than physically deleting relationship history. A block transaction deactivates follows in both directions.
- Acquaintance is derived from two current reciprocal follows with no block in either direction; there is no acquaintance table.
- `notifications` stores durable notification facts; realtime delivery is not storage.
- `message_mentions` is synchronized when content is created or edited so mentions are not reparsed on every read.

### Messages

Extend `messages` with:

- `visibility`: one of the four explicit user-facing scopes; policy uses a conversion matrix, never numeric comparison.
- `audience_anchor_user_id`: identifies whose acquaintance boundary applies when a reply inherits an audience.
- `moderation_state`: published, held, or removed, independent of author soft deletion.
- `content_version`: increments on edits and invalidates review decisions tied to older content.
- `reply_policy`: viewer, acquaintance, or closed for root-writing interaction boundaries.

The existing maximum reply depth makes ancestor-aware access practical without a general recursive content model.

### Governance

- `moderation_cases` represents reports, system holds, and appeals with a primary message or account target.
- `moderation_actions` is append-only and records reasons, policy version, effective period, reversal links, and actors.
- `account_safety` is a private current-state projection for active restrictions, not a public or social score.

Do not add a generic activity stream, event-sourced model, public reputation table, or daily activity summary. The first activity almanac aggregates viewer-authorized messages by day and is supported by a `(user_id, created_at)` index. Materialize only after measured need.

### Migration

1. Back up and audit account ownership, orphan writing, duplicate relationships, and existing counts.
2. Add tables and columns. Backfill existing messages as public and published to preserve current behavior.
3. Create one profile per account from current avatar, signature, theme, and username-as-initial-display-name.
4. Trust existing `user_id` ownership only. Do not claim legacy messages merely because their stored name matches an account.
5. Validate row counts, foreign keys, orphan records, uniqueness, and the complete access matrix before switching reads and writes.
6. Keep legacy columns for at least one rollback window; do not rebuild and clean core tables in the same release.

## 3. Safety, moderation, and account security — approved

Treat account protection, action risk, and content governance as separate layers.

### Account protection

- Browser cookies hold random opaque session tokens; the database stores token hashes only.
- Production cookies are HttpOnly, Secure, and SameSite. State-changing requests additionally require a trusted origin and a session-bound CSRF token.
- Accounts can inspect and revoke individual sessions or all sessions. Password changes, admin-role changes, and confirmed risk events rotate or revoke sessions.
- A currently valid signed login cookie may be exchanged once for a new server session so normal users are not forcibly logged out during migration.
- Email verification and CAPTCHA are step-up controls for registration, abnormal activity, or high-cost capabilities, not recurring interruptions to ordinary writing.
- New accounts may write ordinary text immediately under conservative quotas; external links, uploads, and bulk mentions relax after verification and healthy use.

### Action decision

Signals may include account age, verification, action velocity, repeated content, link and mention volume, and confirmed moderation history. Follower count, likes, popularity, and public social status are never safety signals.

Rate control has two layers:

- Edge/IP flood defense trusts forwarded client addresses only from configured reverse proxies.
- Application quotas combine account, action, target, and content similarity. Cooldowns return stable reason codes plus `Retry-After` or an exact retry time.

The first release uses explainable deterministic rules and human review, not a black-box Chinese semantic model.

### Moderation and appeal

- Held content is stored but not distributed and does not notify mentioned or replied-to accounts. The author immediately sees that review is pending.
- Review cases move through pending, claimed, resolved, cancelled, or expired states. Claims have leases, decisions are idempotent, and each decision is tied to a content version.
- Editing held content invalidates the old decision and starts a new review version.
- If the review or audit transaction fails, content remains held; it can never fail open into publication.
- Moderation actions are append-only. Reversal is a new action, and temporary restrictions are evaluated from `expiresAt` on every request rather than relying on a timer to unlock accounts.
- Appeals link to the original action and content version. Blocking and account restrictions cannot prevent access to report or appeal channels.
- Reporters remain private. After reporting, the UI naturally offers hide, mute, or block.
- Users receive a comprehensible reason category, scope, duration, recovery guidance, and appeal path without seeing internal thresholds or raw detection signals.

## 4. Social flows and notifications — approved

### Two chronological feeds

- **Garden** contains all currently visible public writing.
- **Following** contains public and quiet-public writing from followed accounts plus acquaintance-visible writing the viewer may currently access.
- Both feeds are newest-first without engagement ranking and use a stable `(created_at, id)` cursor so new inserts do not create duplicate or skipped pages.

### Follow and acquaintance

- Follow and unfollow write an explicit desired state rather than a retry-sensitive toggle.
- A one-way relationship displays as followed; reciprocal active follows become acquaintance without a request flow.
- Unfollowing or blocking invalidates acquaintance access and related caches immediately.
- Following and follower counts remain secondary metadata rather than profile identity or ranking.

### Replies and mentions

- Keep the current maximum reply depth of two.
- Root writing has a remembered, per-message reply policy: any authorized viewer, acquaintances only, or closed.
- Replies notify their direct parent author. Stable `@username` mentions notify mentioned accounts, with duplicate recipients merged.
- Display-name changes never break mentions or links.
- Held content creates no outward reply or mention notification until approval.

### Persistent notification inbox

The user-facing name may be **Echoes**. It groups replies, mentions, new follows/acquaintance, and governance messages.

- Replies, mentions, acquaintance formation, and governance outcomes appear promptly.
- Likes aggregate into quiet time-window summaries instead of interrupting for every action.
- Bookmarks remain private and never notify authors.
- Self-actions do not notify the actor, and blocked accounts cannot notify one another.
- Notifications do not store a content-body snapshot. Reads re-authorize the referenced object so later narrowing, deletion, or blocking cannot leak stale excerpts.
- The first release is in-app only; email, mobile push, and third-party delivery are out of scope.

Relationship/content changes and durable notifications commit in one transaction. Realtime delivery occurs only afterward as a targeted invalidation signal.

## 5. Profile, activity, and UI behavior — approved

### Publication-style profile

The profile reads as one vertically edited private publication rather than a dashboard:

1. **Cover**: avatar, display name, secondary stable username, signature, relationship action, personal seal color, paper, and title treatment.
2. **Selected writing**: two to four intentionally pinned entries.
3. **Activity almanac**: viewer-aware annual writing rhythm.
4. **Notes**: gentle summaries such as time-of-day, month rhythm, and writing/reply ratio.
5. **Shelf**: intentionally composed public collections.

Desktop keeps asymmetric whitespace and editorial rhythm. Mobile becomes a single column without turning modules into a generic card grid. The existing light, dark, sumi, and sakura themes remain the base editions; personal choices affect controlled seal color, paper intensity, title face, module order, and module visibility.

### Activity almanac

- Desktop shows a 52-by-7 main year grid using five ink-density levels, followed by one or two clearly labeled "year remainder" cells so 365/366-day years are complete.
- Mobile presents four 13-by-7 seasonal segments plus the same year-remainder cells so dates are never silently omitted.
- The owner may select year and writing, replies, or both.
- Today receives a small cinnabar seal mark; there are no streaks, inactivity warnings, or red failure states.
- Every cell has a date-and-count accessible label. Public, acquaintance, and owner views use the same authorization-aware aggregation.

### Discrete visibility track

Publication scope uses four labeled stops along a grooved track with a circular thumb: public, quiet public, acquaintance, and private. Module and activity visibility use the same visual language with public, acquaintance, and self.

The control is visually a slider but semantically a fixed choice group. It supports pointer input, arrow keys, Home/End, a minimum 44-pixel target, text descriptions, sufficient contrast, and reduced-motion behavior. Color is never the only state indicator.

### Profile editing and privacy preview

- Editing combines settings with live preview, but one explicit save commits the full profile draft.
- Modules support drag ordering plus keyboard-accessible move-up and move-down actions.
- Each module can be hidden or assigned its own audience.
- Owners can preview the result as a public visitor, acquaintance, or themselves before saving.
- Settings are grouped as Appearance, Presentation, Footprint, Boundaries, and Discovery.
- On-site discovery is enabled by default for public accounts; external search-engine indexing is independently controlled and defaults off.
- Arbitrary HTML, CSS, and JavaScript are never accepted.

### Navigation and safety presentation

- Home switches between Garden and Following inside the page.
- Mobile bottom navigation is Garden, Saved, Write, Echoes, and Profile.
- Safety nudges appear as inline editorial notes and preserve the draft instead of interrupting with a modal.
- Echoes uses a restrained cinnabar unread mark rather than an alarm-like red badge.
- Administration uses explicit review language with reason, duration, evidence, and state; visual style never obscures governance meaning.

## 6. Error handling, testing, rollout, and success measures — approved

### Error and recovery contract

- Unauthenticated actions return `401 AUTH_REQUIRED`.
- Missing and unauthorized resources both return `404 NOT_FOUND` to avoid object enumeration.
- State conflicts use stable `409` codes, validation uses `422`, and cooldowns use `429` with `Retry-After` or an exact retry time.
- Review hold is not an error: content returns `202 Accepted` with `state: "held"` and remains visible to its author.
- Clients translate stable codes through i18n and never display raw safety signals.
- Failed submissions preserve text, visibility, and reply-policy drafts.
- Content creation carries a per-account client request ID so network retries do not duplicate writing.
- Failure to write durable notifications rolls back the business transaction. Post-commit SSE failure does not roll back content; focus refresh and polling recover it.

### Required verification per vertical slice

- Table-driven access matrix across viewer, relationship, visibility, moderation state, and ancestor scope.
- IDOR and metadata-leak tests for detail, thread, search, bookmarks, notifications, activity, counts, pagination, and SSE.
- Concurrency and idempotency tests for follow state, block transactions, reactions, and review claims.
- Session, CSRF, cookie, revocation, trusted-proxy, and layered rate-limit tests.
- Migration tests covering backup restore, row counts, ownership, orphans, backfill, compatibility, and rollback window.
- UI checks across all four themes and 375–1440 pixel widths, including keyboard tracks, touch targets, reduced motion, and accessible activity labels.
- Repository gates: `bun test`, backend startup smoke test, `bun run --cwd client build`, and `bun run --cwd client lint`.
- Two independent security review sessions after every security-sensitive slice, with every finding re-read against the current files.

### Progressive rollout

1. Add backward-compatible schema without changing public behavior.
2. Apply the central access predicate to every existing read and verify public-result equivalence.
3. Run new safety decisions in observe mode, while existing hard rules still enforce.
4. Establish a baseline, then enable nudges, cooldowns, and holds in that order.
5. Release relationship boundaries, feeds and Echoes, profiles, and activity as complete vertical slices.
6. Roll back application code while retaining compatible additive schema; never use destructive down migrations for emergency rollback.

### Success measures and privacy

Track held-content approval, appeal reversal, established-user throttling, first-post success, time to first reply, reports per thousand messages, repeated propagation, review delay, and notification interruptions. Establish thresholds from observe-mode baselines rather than inventing them before real traffic.

Authorization, count, pagination, and realtime metadata leaks must remain zero. Metrics come from existing business facts or short-retention structured logs; do not create a generic behavior-tracking table or log content, tokens, email addresses, or raw risk signals.

## Reference patterns

- [OWASP API Security Top 10](https://owasp.org/API-Security/) and [Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) — object authorization, quotas, and resource limits.
- [Discord AutoMod](https://support.discord.com/hc/en-us/articles/4421269296535-AutoMod-FAQ), [Activity Alerts](https://support.discord.com/hc/en-us/articles/17439993574167-Activity-Alerts-Security-Actions), and [Verification Levels](https://support.discord.com/hc/en-us/articles/216679607-Verification-Levels) — pre-publication checks and risk-based step-up friction.
- [Reddit Crowd Control](https://support.reddithelp.com/hc/en-us/articles/15484545006996-Crowd-Control), [Reputation Filter](https://support.reddithelp.com/hc/en-us/articles/27441485903124-Reputation-filter), and [Post Guidance](https://support.reddithelp.com/hc/en-us/articles/17625458521748-Automations-Post-Comment-Guidance-Set-Up) — quiet isolation, behavior signals, and drafting-time nudges.
- [Discourse Trust Levels](https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/) — progressive capability without a public social score.
- [Bluesky moderation architecture](https://docs.bsky.app/blog/blueskys-moderation-architecture) and [moderation labels](https://docs.bsky.app/docs/advanced-guides/moderation) — separation of detection, action, and user controls.
- [Mastodon publishing levels](https://docs.joinmastodon.org/user/posting/) and [personal moderation](https://docs.joinmastodon.org/user/moderating/) — quiet public distribution and user-owned boundaries.
- [GitHub profile contributions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference) and [Strava personal heatmaps](https://support.strava.com/en-us/articles/15402028-personal-heatmaps) — annual activity structure with privacy controls.
- [Letterboxd FAQ](https://letterboxd.com/about/faq/) — identity through selected work and taste rather than productivity ranking.

## Design status

- [x] Product terminology and privacy boundaries
- [x] Delivery strategy
- [x] System boundaries and request flow
- [x] Data model and migration
- [x] Safety, moderation, and account security
- [x] Social flows and notification behavior
- [x] Profile, activity, and UI behavior
- [x] Error handling, testing, rollout, and success measures
