# RyzzUBot — Session Guard

A multi-bot Telegram subscription management platform. Bot owners can deploy subscription bots that handle plan selection, payment approval via inline buttons, userbot (MTProto) creation, and broadcast messaging. The admin dashboard provides full control over bots, subscribers, payment requests, and plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path /api)
- `pnpm --filter @workspace/admin-dashboard run dev` — run the admin dashboard (port 3000, path /admin/)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, pino logging
- Bot: node-telegram-bot-api (polling/webhook), MTProto via `telegram` package
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Admin UI: React + Vite + Tailwind CSS v4 (shadcn/ui components, black & red theme)
- API codegen: Orval (from OpenAPI spec)
- Auth: Replit Auth (OpenID Connect) for admin dashboard
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/services/webhookHandler.ts` — all Telegram bot logic & state machine
- `artifacts/api-server/src/services/telegramMtproto.ts` — MTProto (userbot) OTP/login
- `artifacts/api-server/src/services/botSettings.ts` — per-bot customizable settings
- `lib/db/src/schema/` — all Drizzle schema tables
- `lib/db/drizzle.config.ts` — DB connection config
- `artifacts/admin-dashboard/src/` — React admin UI
- `artifacts/admin-dashboard/src/index.css` — black & red theme (CSS variables)
- `lib/api-spec/openapi.yaml` — source-of-truth API contract

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas
- Per-bot multi-tenancy: every DB table has a `bot_id` foreign key; a single api-server instance serves all bots
- MTProto DC session saved after `sendPhoneCode` and reused in `signInWithCode` to prevent OTP expiry
- `/start` flow shows plan/token choice first; contact sharing only requested when creating a userbot
- Inline reject now triggers a two-step flow: click → type reason → confirm (instead of immediate silent reject)

## Product

- Bot owners register their Telegram bot token via the admin dashboard
- Subscribers message the bot, choose a plan, share payment proof
- Owner sees pending requests in `/owner` panel with ✅ Approve / ❌ Reject buttons
- Rejection triggers a reason-input step — owner types the reason, user receives a formatted message
- Approved users receive a unique activation token; entering it activates their subscription
- Subscribers can create a personal userbot (MTProto login with OTP + optional 2FA)
- Admin dashboard: manage bots, plans, subscribers, payment requests, broadcasts

## User preferences

- Black and red theme for admin dashboard
- Reject button must ask for reason before rejecting (two-step)
- Contact sharing only after plan selection, not at /start
- OTP must not expire during login flow (DC session persisted)

## Gotchas

- Admin dashboard PORT must be 3000 (supported Replit port); hardcoded in artifact.toml [services.env]
- API server port is 8080; proxy routes /api → 8080, /admin/ → 3000
- Run `pnpm --filter @workspace/db run push` after any schema changes before restarting the server
- The `dark` class must be on `<html>` in index.html for the black theme to apply
- Two artifacts share id "artifacts/admin-dashboard" — the extracted_project one is legacy (no .replit-artifact dir now)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
