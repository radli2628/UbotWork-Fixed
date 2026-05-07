# Broadcast Bot Plus

Admin dashboard and API server for managing Telegram broadcast bots with subscription/payment management.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/admin-dashboard run dev` — run the admin dashboard (port 22133, proxied at /admin/)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed plans + payment methods (requires bot ID 1 to exist first)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, base path /api)
- Admin UI: React + Vite + Tailwind CSS (port 22133, base path /admin/)
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit OpenID Connect (browser OIDC + mobile token exchange)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Telegram: `node-telegram-bot-api` (Bot API) + `telegram` (MTProto userbot)

## Where things live

- `lib/db/src/schema/` — DB schema (source of truth)
- `lib/api-spec/openapi.yaml` — API contract (source of truth for codegen)
- `lib/api-client-react/` — generated React Query hooks
- `lib/api-spec/src/zod/` — generated Zod schemas
- `lib/replit-auth-web/` — React hook for Replit Auth in the admin dashboard
- `artifacts/api-server/src/` — Express routes, services, middleware
- `artifacts/api-server/src/services/telegramMtproto.ts` — MTProto userbot service (API_ID=2040 hardcoded)
- `artifacts/api-server/src/services/webhookHandler.ts` — Telegram Bot webhook handler (OWNER_CHAT_ID=6071113355)
- `artifacts/admin-dashboard/src/` — React admin UI

## Architecture decisions

- OpenAPI-first: all routes come from `openapi.yaml`; client hooks and Zod schemas are generated via Orval
- Bot webhook handler uses HTML parse_mode for premium emoji support
- `botSettings.paymentMethods` is a JSONB column; per-payment-method inline keyboard buttons are generated dynamically
- Seed script seeds 4 plans (1/2/3/6 months, Rp8k/16k/24k/42k) and 2 payment methods (BLU BCA, GOPAY) against bot ID 1
- MTProto userbot uses hardcoded `API_ID=2040` / `API_HASH=b18441a1ff607e10a989891a5462e627` (Telegram Desktop credentials)

## Product

- Register and manage multiple Telegram bots
- Per-bot subscriber management, broadcast scheduling, and send logs
- Subscription plans with configurable duration (months) and price
- Flexible payment methods stored in JSONB (per-bot inline keyboard)
- Payment request workflow: user requests → admin approves/rejects → token issued → subscriber activated
- MTProto userbot sessions for premium features (userbot-based broadcasts)
- Admin dashboard with Replit Auth gate

## User preferences

- OWNER_CHAT_ID = "6071113355" (hardcoded in webhookHandler.ts)
- MTProto API_ID=2040, API_HASH=b18441a1ff607e10a989891a5462e627
- Payment methods seed: BLU BCA 003326282628, GOPAY 082287038683, holder "Riz** Ad*****n"
- Plans seed: 1 month Rp8.000 / 2 months Rp16.000 / 3 months Rp24.000 / 6 months Rp42.000

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Run `pnpm --filter @workspace/db run push` after changing any schema file
- Seed script requires bot ID 1 to exist; register a bot via the admin dashboard first
- `bufferutil` and `utf-8-validate` build scripts are suppressed by pnpm (minor peer dep warning from node-telegram-bot-api is harmless)
- Admin dashboard is at `/admin/` (trailing slash matters for Vite base path)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
