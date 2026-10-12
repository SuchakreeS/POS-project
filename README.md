# POS System

Retail point-of-sale system. Phase 1 is online-first (web app + API + PostgreSQL).
The full plan, business rules and design spec are in [`plan.md`](./plan.md).

| Part              | Tech                                                      | Hosted on |
| ----------------- | --------------------------------------------------------- | --------- |
| `apps/web`        | React 19 + TypeScript + Vite 8 + Tailwind CSS 4           | Vercel    |
| `apps/api`        | Node.js + Express 5 + TypeScript + Prisma 7               | Render    |
| `packages/shared` | Shared TypeScript (money helpers, Zod schemas, API types) | —         |
| Database          | PostgreSQL 17 locally, Supabase in production             | Supabase  |

Commands below are for **Git Bash** (Windows) or any bash shell.

## First-time setup

### 1. Tools

- **Node.js 22 LTS** (22.12 or newer) — check with `node -v`
- **pnpm** through Corepack (comes with Node): `corepack enable`
  (the pnpm version is pinned in `package.json`)
- **PostgreSQL 17** for local development

### 2. Install

```bash
cd ~/Desktop/POS-Project
pnpm install
```

This also runs `prisma generate` (the typed database client in `apps/api/src/generated`).

### 3. Database

Local development uses a local PostgreSQL database, e.g. `pos_dev`:

```bash
psql -U postgres -c "CREATE DATABASE pos_dev;"
```

For staging / production, create a Supabase project (region Southeast Asia, Singapore) and use its
**Transaction pooler** URL (port 6543) as `DATABASE_URL` and **Session pooler** URL (port 5432) as `DIRECT_URL`.

### 4. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

In `apps/api/.env` fill in:

- `DATABASE_URL` and `DIRECT_URL` — locally both are
  `postgresql://postgres:<password>@localhost:5432/pos_dev`
- `SEED_ADMIN_PASSWORD` — the first admin's password (8+ characters)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — two different long random strings:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

`.env` files are git-ignored. Never commit them or paste secrets into chats.

### 5. Create the tables

```bash
pnpm db:init    # first time only: creates and applies the first migration
pnpm db:seed    # shop settings, terminal T1, first admin, sample products (safe to re-run)
```

### 6. Run it

```bash
pnpm dev
```

- Web: http://localhost:5173 → log in with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`
- Setup check (web → API → database): http://localhost:5173/setup
- API: http://localhost:4000/health?db=1

## Everyday commands

| Command                      | What it does                                                   |
| ---------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                   | Run web + API together (or `pnpm dev:web` / `pnpm dev:api`)    |
| `pnpm typecheck`             | TypeScript check for all packages                              |
| `pnpm lint`                  | ESLint                                                         |
| `pnpm format`                | Prettier (write)                                               |
| `pnpm test`                  | Vitest (all packages)                                          |
| `pnpm build`                 | Production build of all packages                               |
| `pnpm db:migrate --name <x>` | After changing `schema.prisma`: create + apply a new migration |
| `pnpm db:deploy`             | Apply existing migrations (staging / production)               |
| `pnpm db:seed`               | Seed data                                                      |
| `pnpm db:studio`             | Browse the database in Prisma Studio                           |
| `pnpm user:create`           | Add a user (e.g. a cashier) from the terminal                  |
| `pnpm user:reset-password`   | Set a new password for a user (logs them out everywhere)       |

`db:init` and `db:migrate` add **row level security** to every new table automatically, so
Supabase's public Data API can't read the data — only our API can.

### Database integration tests (optional)

The auth tests that hit a real database are skipped unless `TEST_DATABASE_URL` is set. Point it at a
**separate** database that has the migrations applied (never your real data):

```bash
psql -U postgres -c "CREATE DATABASE pos_test;"
cd apps/api
DIRECT_URL="postgresql://postgres:<password>@localhost:5432/pos_test" npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://postgres:<password>@localhost:5432/pos_test" pnpm test
```

## Project structure

```
apps/
  api/                        Express API (Render)
    prisma/schema.prisma      Database schema (source of truth)
    prisma/seed.ts            Seed data
    prisma.config.ts          Prisma CLI config (Prisma 7)
    scripts/                  esbuild build, migrate (+ row level security)
    src/
      app.ts, server.ts       Express app and entry point
      env.ts, config.ts       Checked environment variables, fixed settings
      routes.ts               Mounts every module's router
      modules/<feature>/      One folder per feature (auth, health, ...)
      middleware/             requireAuth / requireRole, validate, errors, rate limit
      audit/                  writeAudit() + fixed list of actions
      lib/                    prisma client, HttpError, request meta
  web/                        React app (Vercel)
    src/
      app/                    router, sidebar navigation, query client
      pages/                  one file per route
      components/ui/          Button, TextField, Dialog, Alert, EmptyState, Spinner
      components/layout/      AppLayout + right Sidebar, PageHeader
      features/<feature>/     store, API calls and components per feature (auth, ...)
      lib/                    http client (refresh + retry), api instance, config
      index.css               Tailwind theme tokens (Royal minimal palette, Prompt font)
packages/
  shared/                     Code shared by web and API (money, auth schemas, API error types)
plan.md                       Phase 1 plan, rules and design spec
```

## Build order

See `plan.md` → section 10.
