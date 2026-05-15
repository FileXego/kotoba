# 言 葉 (Kotoba)

> A zen-minimalist message board. Washi paper aesthetic. Dark mode with ink-wash transition. Japanese / Chinese bilingual.

## Features

- 📝 Post messages with image attachments
- 💬 3-level nested replies
- 🔍 Keyword search + pagination
- ❤️ Like & bookmark with persistence
- 🌙 Dark mode with ink-spread transition animation
- 🇯🇵🇨🇳 Japanese / Chinese bilingual UI
- 👤 User accounts (sign up / sign in)
- 🛡️ Turnstile CAPTCHA on registration
- 🛠️ Admin panel for moderation
- 0 extra npm dependencies — Bun built-ins only

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | [Bun](https://bun.sh) |
| Backend | [ElysiaJS](https://elysiajs.com) + TypeBox |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + SQLite |
| Frontend | React 19 + Vite 8 + TypeScript |
| Auth | Bun.password + signed cookies |
| CAPTCHA | Cloudflare Turnstile |
| i18n | Hand-rolled TS objects (0 deps) |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USER/kotoba.git
cd kotoba

# 2. Install (uses Bun)
bun install
cd client && bun install && cd ..

# 3. Configure environment
cp .env.example .env
# Edit .env — set COOKIE_SECRET (any random string)
# TURNSTILE_SECRET is optional for development

# 4. Run database migrations
bun run db:migrate

# 5. Start (two terminals)
bun run dev                  # Backend → http://localhost:3000
bun run dev --cwd client     # Frontend → http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COOKIE_SECRET` | Yes in production | Random string for session cookie signing |
| `TURNSTILE_SECRET` | For CAPTCHA | Cloudflare Turnstile secret key |

See `.env.example` for dev defaults.

## API Overview

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/messages?offset=&limit=&q=` | — |
| `POST` | `/api/message` | Login |
| `PATCH` | `/api/message/:id` | Author |
| `POST` | `/api/messages/:id/like` | Login |
| `POST` | `/api/messages/:id/bookmark` | Login |
| `POST` | `/api/auth/sign-up` | Captcha |
| `POST` | `/api/auth/sign-in` | — |
| `GET` | `/api/admin/*` | Admin |

## Architecture

```
src/
├── plugins/    auth.ts · admin.ts · captcha.ts    ← Elysia micro-apps
├── routes/     message.ts · upload.ts             ← Route handlers
├── db/         schema.ts · index.ts               ← Drizzle + SQLite
client/
└── src/        App → Header · SubmitForm · MessageList → MessageCard
```

Elysia plugins are composed via `.use()`. Order matters: `auth` must be mounted before `messageRoute` so `currentUser` derives correctly.

## Design

- **Washi paper texture**: SVG `feTurbulence` noise filter — no images
- **Starry night dark mode**: pure CSS `radial-gradient` stars
- **Ink-wash theme transition**: `clip-path` ellipse spread + `mix-blend-mode: difference`
- **Asymmetric border-radius**: `2px 8px 2px 8px` evokes brush-stroke edges
- **Fonts**: `Noto Serif JP` (display) + `Noto Sans SC` (body)

## i18n

All UI text in `client/src/i18n.ts`. To add a language: create a new object with the same keys as `ja`/`zh`, add to the `t()` function.

## License

MIT © 2026
