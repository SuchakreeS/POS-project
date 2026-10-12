# POS System

Retail point-of-sale system. Phase 1 is online-first (web app + API + Supabase Postgres).
The full plan, business rules and design spec are in [`plan.md`](./plan.md).

| Part              | Tech                                                 | Hosted on |
| ----------------- | ---------------------------------------------------- | --------- |
| `apps/web`        | React 19 + TypeScript + Vite 8 + Tailwind CSS 4      | Vercel    |
| `apps/api`        | Node.js + Express 5 + TypeScript + Prisma 7          | Render    |
| `packages/shared` | Shared TypeScript (money helpers, later Zod schemas) | —         |
| Database          | PostgreSQL                                           | Supabase  |

## First-time setup (Windows, PowerShell)

### 1. Tools

- **Node.js 22 LTS** (22.12 or newer): https://nodejs.org — check with `node -v`
- **pnpm** through Corepack (comes with Node):

  ```powershell
  corepack enable
  ```

  The project pins its pnpm version in `package.json`, so you don't install pnpm yourself.

### 2. Install

```powershell
cd $HOME\Desktop\POS-Project
pnpm install
```

This also runs `prisma generate` (creates the typed database client in `apps/api/src/generated`).

### 3. Supabase project

1. Create a project at https://supabase.com — region **Southeast Asia (Singapore)**, save the database password.
2. Open the project → **Connect** → copy two connection strings:
   - **Transaction pooler** (port **6543**) → `DATABASE_URL` (used by the running API)
   - **Session pooler** (port **5432**) → `DIRECT_URL` (used for migrations and seeding)
     Replace `[YOUR-PASSWORD]` in both with your database password.

### 4. Environment files

```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
```

Open `apps\api\.env` and fill in:

- `DATABASE_URL`, `DIRECT_URL` from step 3
- `SEED_ADMIN_PASSWORD` — the first admin's password (8+ characters)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — long random strings:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

`.env` files are git-ignored. Never commit them.

### 5. Create the database

```powershell
pnpm db:init
pnpm db:seed
```

- `db:init` creates the first migration from `apps/api/prisma/schema.prisma`, adds
  **row level security** for every table (so Supabase's public Data API can't touch the data —
  only our API can), and applies it.
- `db:seed` adds shop settings, terminal **T1**, the first admin user, and a few sample products.
  It's safe to run again.

### 6. Run it

```powershell
pnpm dev
```

- Web: http://localhost:5173 — the setup check page should show **Web app, API and Database all
  "Connected"**.
- API: http://localhost:4000/health?db=1

## Everyday commands

| Command           | What it does                                                   |
| ----------------- | -------------------------------------------------------------- |
| `pnpm dev`        | Run web + API together (or `pnpm dev:web` / `pnpm dev:api`)    |
| `pnpm typecheck`  | TypeScript check for all packages                              |
| `pnpm lint`       | ESLint                                                         |
| `pnpm format`     | Prettier (write)                                               |
| `pnpm test`       | Vitest                                                         |
| `pnpm build`      | Production build of all packages                               |
| `pnpm db:migrate` | After changing `schema.prisma`: create + apply a new migration |
| `pnpm db:seed`    | Seed data                                                      |
| `pnpm db:studio`  | Browse the database in Prisma Studio                           |

### When you add a table later

Every new table needs row level security too. After `pnpm db:migrate --create-only --name <name>`,
add `ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` to the new migration file, then run
`pnpm db:migrate`.

## Project structure

```
apps/
  api/                      Express API (Render)
    prisma/schema.prisma    Database schema (source of truth)
    prisma/seed.ts          Seed data
    prisma.config.ts        Prisma CLI config (Prisma 7)
    scripts/                build (esbuild) and db-init helpers
    src/
      app.ts, server.ts     Express app and entry point
      env.ts                Checked environment variables
      lib/prisma.ts         Prisma client (pg driver adapter)
      audit/actions.ts      Fixed list of audit log actions
      modules/<feature>/    One folder per feature (from step 2)
      middleware/, jobs/, integrations/
  web/                      React app (Vercel)
    src/index.css           Tailwind theme tokens (Royal minimal palette, Prompt font)
packages/
  shared/                   Code shared by web and API
plan.md                     Phase 1 plan, rules and design spec
```

## Build order

See `plan.md` → section 10. Step 1 (this setup) is done once the setup check page is all green.
