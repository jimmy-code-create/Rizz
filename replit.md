# Nexus

A full-featured social media platform with posts, stories, reels, DMs, group chats, community servers, video/voice calls, badges, and a leaderboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from env)
- `pnpm --filter @workspace/nexus run dev` — run the Nexus frontend (port from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + session-based auth (bcryptjs)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React 19 + Vite + Tailwind CSS + wouter
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle for API)
- Real-time: SSE (Server-Sent Events)
- Push: web-push (VAPID)

## Where things live

- `artifacts/api-server/src/` — Express backend
  - `src/routes/` — API route handlers (auth, users, posts, dm, groups, stories, servers, reels, calls, etc.)
  - `src/lib/` — db, auth, SSE, push helpers
- `artifacts/nexus/src/` — React frontend
  - `src/components/` — shared UI components
  - `src/pages/` — page-level components (feed, profile, DMs, etc.)
  - `src/hooks/` — custom hooks (auth, push, presence)
  - `src/contexts/` — ThemeContext, etc.
- `lib/db/src/schema/index.ts` — Drizzle schema (source of truth for DB)
- `render.yaml` — Render deployment blueprint

## Architecture decisions

- Session-based auth (express-session + bcryptjs) — no JWT
- SSE for real-time notifications and messaging (no WebSocket)
- VAPID-based web push notifications (web-push library)
- Uploads stored on disk at `artifacts/api-server/uploads/` — use object storage for production
- All API routes prefixed with `/api`

## Product

Nexus is a social platform where users can post content, follow others, send DMs, join community servers, share stories and reels, react to messages, make voice/video calls, earn badges, and compete on a leaderboard.

## User preferences

- Deploying on Render via GitHub

## Gotchas

- Upload files are stored locally — not suitable for multi-instance deployments. Use Render Disk or object storage in production.
- SSE connections are in-process — restart drops all connections
- `pnpm --filter @workspace/db run push` needs DATABASE_URL set
- Run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Render deployment: connect GitHub repo to render.com, it auto-reads `render.yaml`
