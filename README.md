# 言 葉 (Kotoba)

> A zen-minimalist message board. Washi paper aesthetic. Dark mode with ink-wash transition. Japanese / Chinese bilingual.

## Features

- Post messages with image attachments
- 3-level nested replies
- Keyword search + pagination
- Like & bookmark with persistence
- Bookmarks page (saved messages)
- Realtime cross-device sync for messages, likes, and private bookmark state via Server-Sent Events with browser/proxy fallback polling
- 4 theme presets (Washi / Night / Sumi / Sakura) with per-theme atmosphere layers
- Modern Eastern editorial system — offset folio rail, page furniture, spine-led threads, seal details, and restrained scroll-open motion
- Avatar upload + personal signature
- Ink-wash theme transition animation
- Mobile web support — responsive shell, bottom navigation, thread detail, bookmarks, profile, admin-safe compact views, and safe-area spacing
- Japanese / Chinese bilingual UI
- User accounts (sign up / sign in)
- Turnstile CAPTCHA on registration
- Admin panel for moderation
- Content-Security-Policy header on all responses
- Bot / scraper guard — User-Agent filter + JS cookie gate + read rate limit
- 92 tests (bun:test, 0 extra deps)
- Governed frontend foundation — Motion plus self-hosted OFL fonts; no component-level plugin sprawl

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | [Bun](https://bun.sh) |
| Backend | [ElysiaJS](https://elysiajs.com) + TypeBox |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + SQLite |
| Frontend | React 19 + Vite 8 + TypeScript + Motion |
| Auth | Bun.password + signed cookies |
| CAPTCHA | Cloudflare Turnstile |
| i18n | Hand-rolled TS objects (0 deps) |

## Quick Start

```bash
# 1. Clone
git clone <your-repository-url> kotoba
cd kotoba

# 2. Install (uses Bun)
bun install
bun install --cwd client

# 3. Configure environment
cp .env.example .env
# Edit .env — set COOKIE_SECRET (any random string)
# TURNSTILE_SECRET is optional for development

# 4. Run database migrations
bun run db:migrate

# 5. Start (two terminals)
bun run dev                  # Backend → http://localhost:3000
bun run --cwd client dev     # Frontend → http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COOKIE_SECRET` | Yes in production | Random string for session cookie signing |
| `TURNSTILE_SECRET` | For CAPTCHA | Cloudflare Turnstile secret key |
| `VITE_TURNSTILE_SITEKEY` | For CAPTCHA UI | Cloudflare Turnstile site key, read by Vite from root `.env` |
| `VITE_MOBILE_ROUTES_ENABLED` | For mobile launch | Enables mobile bottom navigation, thread detail, and profile routes when set to `true` |
| `DB_PATH` | Production recommended | SQLite database path |
| `UPLOAD_DIR` | Production recommended | Persistent upload directory |

See `.env.example` for dev defaults.

## API Overview

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/messages?offset=&limit=&q=` | — |
| `POST` | `/api/message` | Login |
| `PATCH` | `/api/message/:id` | Author |
| `GET` | `/api/messages/:id/replies` | — |
| `POST` | `/api/messages/:id/like` | Login |
| `POST` | `/api/messages/:id/bookmark` | Login |
| `GET` | `/api/events` | Cookie optional |
| `GET` | `/api/bookmarks?offset=&limit=` | Login |
| `POST` | `/api/upload` | Login |
| `POST` | `/api/auth/sign-up` | Captcha |
| `POST` | `/api/auth/sign-in` | — |
| `GET` | `/api/auth/me` | Cookie |
| `PATCH` | `/api/auth/me` | Login |
| `PATCH` | `/api/auth/avatar` | Login |
| `GET` | `/api/health` | — |
| `GET` | `/api/admin/*` | Admin |

## Architecture

```
src/
├── plugins/    rate-limiter.ts · auth.ts · admin.ts    ← Elysia plugins
├── routes/     message.ts · bookmark.ts · events.ts · upload.ts ← Route handlers
├── db/         schema.ts · index.ts                     ← Drizzle + SQLite
├── lib/        files.ts · images.ts · pagination.ts · realtime.ts ← Shared guards/events
├── app.ts      createApp({ staticMode })                ← Unified app factory
├── index.ts    dev entry
├── start.ts    prod entry (static + SPA fallback)
client/
└── src/        App → EditorialFrame → Header · routed PageTransition
                ├── components/  SubmitForm · MessageList → MessageCard · route pages
                ├── design/      centralized motion language
                └── assets/      versioned paper/ink textures + self-hosted font subset
```

Elysia plugins are composed via `.use()`. Order matters: `auth` must be mounted before `messageRoute` so `currentUser` derives correctly.

Production deployment keeps releases and data separate: code lives under `/opt/kotoba/releases`, while `.env`, `sqlite.db`, uploads, and backups live under `/opt/kotoba/shared`.

## Design

- **Editorial structure**: an offset desktop folio rail and a bordered paper column replace the generic centered card feed; route numbers, dates, entry indexes, and spine lines behave like page furniture.
- **Four editions**: Washi, Night, Sumi, and Sakura share one spacing/typography system while swapping paper, ink, seal, line, and atmosphere tokens.
- **Project-owned materials**: versioned SVG paper fibers, ink clouds, and sumi grain remain low contrast and decorative; the UI still works when backgrounds are disabled.
- **Motion language**: Motion drives one restrained page/list entrance system; theme changes retain the ink spread. `prefers-reduced-motion` removes translation, scaling, and atmospheric drift.
- **Mobile composition**: the folio collapses into a compact page header, while the fixed bottom navigation becomes a set of typographic bookmarks with safe-area spacing.
- **Fonts**: variable Noto Serif SC/JP provides bilingual editorial text. A project-subsetted LXGW WenKai (~96KB) is reserved for notes and empty states, with its OFL license stored beside the asset.

## i18n

All UI text in `client/src/i18n.ts`. To add a language: create a new object with the same keys as `ja`/`zh`, add to the `t()` function.

## License

MIT © 2026
