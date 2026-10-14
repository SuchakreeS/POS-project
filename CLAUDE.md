# POS System — notes for Claude

Retail POS for a real shop (Phase 1), built by PS. pnpm monorepo: `apps/api` (Express 5 + Prisma 7),
`apps/web` (React 19 + Vite), `packages/shared` (zod schemas, types and pure logic used by both).

**`plan.md` is the source of truth**: scope, business rules (§2), stack (§3), data model (§6), API
endpoints (§7), pages (§8), design specs for every screen (§9), build order with progress notes (§10),
must-pass tests (§11), open items (§12). It's long, so read only the sections the current step needs.
Before starting a build step, read its line in §10 and its screen specs in §9.

## Working with PS

- Casual tone, "bro" is fine. Metric units.
- PS uses **Git Bash on Windows**: give bash commands, never PowerShell.
- Write clean, maintainable code. **Refactor on the first pass**: when new code would copy logic that
  already exists, move it to one shared place first (past examples: `fields.ts` note schema,
  `lib/cursor.ts`, the test cleanup helpers, `PAYMENT_METHOD_LABELS`).
- Run `git status` before editing. **Never overwrite PS's uncommitted changes without asking.**
- Don't commit. PS commits each step himself; finish by suggesting a commit message.
- Never print or paste secrets (JWT secrets, DB passwords, LINE token). `.env` files are never
  committed. The LINE token lives in env vars only, never in the Settings UI.
- Leave `apps/api/.claude/skills/` (PS's Prisma skills) alone.

## Commands (repo root)

| Command                                                                            | What                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`                                                                         | API on :4000 + web on :5173 (Vite proxies `/api` → :4000; `VITE_API_URL="/api"`) |
| `pnpm format` / `pnpm lint` / `pnpm typecheck`                                     | Prettier, ESLint, tsc for all packages                                           |
| `pnpm test`                                                                        | Vitest everywhere. DB tests are skipped unless `TEST_DATABASE_URL` is set        |
| `TEST_DATABASE_URL="postgresql://postgres:<pw>@localhost:5432/pos_test" pnpm test` | Full run incl. DB integration tests                                              |
| `pnpm db:migrate --name <x>`                                                       | After editing `schema.prisma`: create + apply migration (adds RLS to new tables) |
| `pnpm db:deploy` then `pnpm db:generate`                                           | Apply migrations that already exist + rebuild the client                         |
| `pnpm user:create` / `pnpm user:reset-password`                                    | Manage logins from the terminal                                                  |

Local DBs: `pos_dev` (app) and `pos_test` (tests; apply new migrations there too with
`cd apps/api && DIRECT_URL=".../pos_test" npx prisma migrate deploy`). Never run tests against real data.

## Layout

- `packages/shared/src/<area>.ts` (+ `.test.ts`): schemas, types, labels, pure helpers.
- `apps/api/src/modules/<area>/`: `*.routes.ts` (thin), `*.service.ts`, `*.mapper.ts`,
  `*.integration.test.ts`. Also `lib/` (prisma, http-error, cursor, request-context, request-input),
  `audit/`, `middleware/`, `test/db-helpers.ts`.
- `apps/web/src/`: `app/` (router, query client, navigation), `components/ui/` (design-system parts),
  `components/layout/`, `features/<area>/` (`queries.ts`, `*-view.ts` pure logic + tests,
  `components/`), `pages/`, `lib/` (api client, datetime, errors, forms).

## Rules everywhere

- **Money is integer satang.** Use `formatSatang` / `formatTHB` / `parseThb`, never floats.
- **Shop days are Bangkok days** (`bangkokDateKey`, `bangkokDayRange`, `bangkokPeriod`, `addDays`).
  Show times with `lib/datetime.ts`, never the PC's own zone.
- One zod schema in `shared` validates on both sides: `z.input` types on the web, `z.output` in the API.
  Optional text uses `noteSchema` / `optionalText` from `fields.ts`; labels shared by UI and reports go in `shared`.
- Pure logic goes in `shared` or a `features/*/…-view.ts` file, with unit tests.

## API conventions

- Routes stay thin: `validateBody(schema)`, `parseQuery(schema, req)`, `routeParam(req, "id")`,
  `requestContext(req)` → `service(input, ctx)`. Admin-only: `requireRole("ADMIN")` (cashiers get 403).
- Errors: throw `HttpError.badRequest / notFound / conflict / duplicate(field, msg)`. Body is
  `{ error: { code, message, issues? } }`; `issues[].path` lets the web put the message on the right field.
- Every write runs in `prisma.$transaction`, with `writeAudit(tx, ctx.actor, entry, ctx.meta)` in the
  **same** transaction. Actions come from `audit/actions.ts`, with before/after and the reason.
  Never store passwords or tokens in audit.
- Race safety: lock with `SELECT … FOR UPDATE` (customer for credit, order for void). Update stock in
  product-id order. Never trust client totals. Checkout uses an Idempotency-Key.
- Lists: newest first, cursor paging via `lib/cursor.ts`, `take: limit + 1`.
- Prisma 7 + `@prisma/adapter-pg`. The generated client in `src/generated/` is gitignored.
- DB tests: Supertest against a real DB, `describe.skipIf(!dbTestsEnabled)`. Each file has its own
  terminal code, barcode/name/user prefixes and cleans up only its own rows (`test/db-helpers.ts`).
  Files run one at a time (`fileParallelism: false`); still filter list assertions by your prefix.

## Web conventions

- Router: `app/router.tsx`, pages loaded with `lazy`. Admin pages are wrapped in `RequireRole`.
- TanStack Query: one keys object per feature. After a mutation, invalidate everything it affects
  (a void refreshes orders, products, movements, PromptPay and credit). `orders/order-keys.ts` is
  separate to avoid import cycles.
- Reuse `components/ui` (Dialog sm/md/lg/xl, Button variants, Chip, Badge, TextField, SearchInput,
  Select, DateRangeChip, StatCard, EmptyState, Alert, ConfirmDialog, `useDiscardConfirm`, `toast`)
  before making anything new. Follow the plan.md §9 specs.
- Dialogs are **mounted only while open** (return `null` when closed) so state starts fresh.
  Item, customer and bill dialogs are standalone: they take an id and load their own data.
- Forms: client checks mirror the shared schema, `focusFirstInvalid(form)`, and API `issues` are mapped
  to fields. Initial focus goes on a safe button (`autoFocus`), never a destructive one. Solid red
  (`dangerSolid`) is only used inside a confirm step.
- Bills open anywhere with `openBill(id)` / `<BillLink>` (one global `BillViewer` per layout).
- Checkout has a global key handler (scan box, F2/F4/F9, Delete). Anything shown on top of it must
  make that handler ignore keys.
- Lint: react-hooks (no setState inside effects; use `useEffectEvent`) and react-refresh (keep non-component
  helpers in `.ts` files).
- Copy: short plain English, sentence case. Badges always have text, never color alone. Empty states
  are an icon, one bold line and one gray line.

## Finishing a step

1. `pnpm format`, `pnpm lint`, `pnpm typecheck`, tests with `TEST_DATABASE_URL`, all green.
2. Walk through the new screens in the browser (`pnpm dev`), including errors and empty states.
3. Update `plan.md`: tick the step in §10 with API / Web / Refactor notes, and update the §7 endpoint list.
4. Tell PS what was built, a bullet list of **what to check** in the app, any migration commands to run,
   and a commit message.

## Where we are

Steps 1–10 are done (plan.md §10 has notes for each). Next:

- **11. Reports + LINE**: manual summary, saved daily snapshot, LINE push, scheduled trigger.
  Decide the trigger first (plan.md §12). Also the Settings LINE status box + "Send test".
- **12. Testing pass** (plan.md §11) and **13. Deploy** (Vercel + Render + Supabase).
- After Phase 1: the Admin **Activity** page (plan.md → Later phases).
