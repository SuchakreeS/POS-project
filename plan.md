# POS System — Phase 1 Plan

**Business type:** Retail
**Approach:** Online-first, built offline-ready (offline mode comes in a later phase)
**Status:** Approved, 2026-10-06

---

## 1. Phase 1 scope

### In
1. **Product catalog**
   - Products: name, SKU, barcode, category, selling price, cost price, active/inactive
   - Categories
   - Low-stock threshold per product
2. **Inventory**
   - Restock (refill)
   - Auto cut stock on every sale
   - Manual adjustment with a required reason (damage, lost, recount)
   - Movement history per product
   - Low-stock list
3. **Checkout**
   - Barcode scan (scanner acts as keyboard) + name/SKU search
   - Cart: add, change qty, remove
   - Manual THB discount on the whole bill
4. **Payments** (one method per bill)
   - Cash: cash received, change calculated
   - Thai QR PromptPay: one printed shop QR at the counter, bill saved as **pending**, staff marks it **received** later after checking the bank app
   - Credit (เงินเชื่อ): customer name, bill total added to what they owe
5. **PromptPay check page**
   - List of pending PromptPay bills (time, bill no, amount, cashier)
   - Mark as received (single or several at once)
   - Unpaid after checking → void the bill
6. **Credit page**
   - List of customers with outstanding balance
   - Per-customer history
   - Record repayment (full or partial)
7. **Orders**
   - Order history with search and filters
   - Void bill: reason required, stock returned, credit charge reversed, never deleted
8. **Daily reports**
   - Auto: runs at closing time, saved as a snapshot, pushed to the shop LINE group
   - Manual: any date range, on demand
9. **Users & roles**: Admin / Cashier, JWT login
10. **Audit log**: written on every sensitive action, no UI in Phase 1

### Out (later phases)
- Percent discounts
- Split payments, credit/debit card
- Dynamic QR with the amount built in, automatic PromptPay confirmation (bank API / slip verification)
- Offline mode + sync
- Audit log UI (built **immediately after Phase 1**, see Later phases)
- Customer loyalty, multi-branch UI, promotions
- Receipt printer / cash drawer hardware
- Tax invoice (ใบกำกับภาษี) format

### Offline-ready rules (apply from day one)
- UUID primary keys, never auto-increment
- Money stored as integer satang (100 THB = 10000)
- Stock tracked as movements, not an overwritten number
- Idempotency key on every order
- Bill numbers per terminal: `T1-000001`
- Orders store both `clientCreatedAt` and server `createdAt`

---

## 2. Business rules

### Money
- All amounts are integers in satang. Convert to THB only for display.
- Never use floats for money anywhere (DB, API, frontend math).

### Discount (Phase 1: fixed THB)
```ts
discountAmount = min(max(discountValue, 0), subtotal)
total          = subtotal - discountAmount   // never below 0
```
- Example: subtotal 100 THB, discount 10 THB → total 90 THB
- Example: subtotal 50 THB, discount 80 THB → discount applied 50 THB, total 0 THB
- Store both the typed value (`discountValue`) and the applied value (`discountAmount`).
- `discountType` is stored (`FIXED` now, `PERCENT` later).
- Every discount is written to the audit log.

### Credit (เงินเชื่อ)
- Credit sale creates a `CHARGE` entry linked to the order.
- Repayment creates a `REPAYMENT` entry with `method` (CASH or PROMPTPAY); partial allowed, cannot exceed balance.
- `balance = sum(CHARGE) - sum(REPAYMENT) - sum(CHARGE_VOID)` per customer.
- Only `REPAYMENT` counts as money received (split by method in reports and the cash count).
- Customer name is matched on a normalized key (trimmed, lowercased); UI autocompletes existing customers.
- Voiding a credit bill creates a `CHARGE_VOID` entry for the same order and amount (lowers the balance, is not money received); the original `CHARGE` is never deleted. If the customer already paid part of it, the balance can go negative (shop owes them); show it as "Credit 50.00 ฿" and handle it manually in Phase 1.

### PromptPay (printed static QR)
- The shop prints its own PromptPay QR (from the bank/merchant app) and puts it at the counter. The POS does not generate QR codes in Phase 1.
- At checkout, cashier picks PromptPay → order saved with `promptpayStatus = PENDING`.
- Stock is cut immediately (the goods have left the store).
- Later, staff checks the bank app and marks the bill `RECEIVED` → stores who and when, writes `PROMPTPAY_RECEIVED` to the audit log.
- Staff should match by **amount + time**, since the static QR carries no bill reference. Two bills with the same amount close together need care.
- If the money never arrives: void the bill with a reason (stock returns).
- Only `PENDING → RECEIVED` is allowed. Undoing a mistaken "received" needs a reason and is audit logged.

### Stock
- `INITIAL` (positive, starting stock when a product is created, once per product), `SALE` (negative), `RESTOCK` (positive), `ADJUST` (+/-, reason required), `VOID_RETURN` (positive).
- Creating a product with starting stock writes the product, the `INITIAL` movement, `stockQty`, and the audit log (`PRODUCT_CREATE`) in one transaction. Starting stock 0 creates no movement.
- `Product.stockQty` is a cached total, updated in the same transaction as the movement row.
- Selling below zero stock is allowed but flagged (prepares for offline later).
- **Misclick guard at checkout (decided 2026-10-13):** adding more than the stock count (an Out item, or the 4th of 3) asks first — "Only 3 Cooking oil in stock · Don't add / Add anyway", with **Don't add** focused so a stray click or Enter adds nothing. Asked once per item per bill. The cart line then shows "Only 3 in stock" / "Out of stock" in amber. Never a hard block: the count can be wrong (delivery not entered yet).

### Checkout transaction (all-or-nothing)
In one `prisma.$transaction`:
1. Check idempotency key (return existing order if already processed)
2. Increment terminal `lastBillSeq`, build bill number
3. Load products, snapshot name and price onto order items
4. Calculate subtotal, discount, total on the server (never trust client totals)
5. Create order + items
6. Create `SALE` stock movements, update `stockQty`
7. If credit: create/find customer, create `CHARGE`
8. Write audit log

### Void
- Cashier or Admin, reason required.
- Same transaction: set status `VOIDED`, `VOID_RETURN` movements, reverse credit charge if any, audit log.

### Reports
Report contents:
- Number of bills, gross sales, total discounts, net sales
- Sales by payment method (cash / PromptPay / credit)
- **Money received** = cash + PromptPay marked received + credit repayments (shown separately from sales)
- **PromptPay pending**: count + amount still not checked (all dates, not only today), so nothing gets forgotten
- Voided bills (count + amount)
- Top products by qty and amount
- Low-stock items

Day boundaries use **Asia/Bangkok** time, even though servers run in UTC.

### Roles
Two roles only. Cashier can run the whole shop; Admin adds user and settings management.

| Action | Cashier | Admin |
|---|---|---|
| Checkout, take payment | ✅ | ✅ |
| Record credit repayment | ✅ | ✅ |
| Mark / undo PromptPay received | ✅ | ✅ |
| View products / stock | ✅ | ✅ |
| See cost price | ✅ | ✅ |
| Edit products and prices, restock, adjust stock | ✅ | ✅ |
| Void bill | ✅ | ✅ |
| Reports (manual, saved, resend to LINE) | ✅ | ✅ |
| Manage users, settings | ❌ | ✅ |

Since cashiers can void, discount, change prices and adjust stock, the audit log is the main safety net. Every one of those actions must be logged with who, when, before/after and reason.

### Auth (built in step 2)
- **Access token**: JWT (HS256), 15 minutes, kept in memory only (never localStorage), sent as `Authorization: Bearer …`.
- **Refresh token**: random 32 bytes in an httpOnly cookie `pos_refresh` (path `/auth`; dev `SameSite=Lax`, prod `SameSite=None; Secure`). The database keeps only its HMAC hash in the `Session` table. Every refresh **rotates** it and extends the session to 7 days from now (sliding), so a shop PC that is used daily stays logged in.
- Logout revokes the session. Turning a user off blocks their next refresh (within 15 minutes everywhere).
- Every request carries `x-pos-client: web`; auth endpoints reject requests without it (blocks cross-site form posts).
- Login is rate-limited (10 failed tries per 15 minutes per IP + username). Wrong username and wrong password give the same message; "turned off" is only shown after the right password.
- Web: on 401 the client refreshes once and retries. Parallel refreshes share one request, and tabs take turns through the Web Locks API, because rotation makes a second refresh with the same cookie fail.
- If the session ends while a page is open, the page stays and the "Please log in again" dialog opens over it (section 9 → Session expired).
- Audit: `LOGIN`, `LOGIN_FAILED` (with reason), `LOGOUT`.

### Audit log (Phase 1: recorded, no screen yet)
Stored in the `AuditLog` table from day one. There is **no page in Phase 1**; the "Activity" screen is the **first thing built right after Phase 1** (see Later phases). Until then, the admin can read it in Supabase. Not shown in the sidebar.

**Rules:** append-only (no update/delete endpoints; revoke UPDATE/DELETE on the table for the app's DB user), written in the **same transaction** as the action, created **server-side only** (user taken from the JWT, never from the client), stores before/after snapshots and the reason where one is required, never stores passwords or tokens. Every entry snapshots the user name and role, terminal, IP and user agent.

| Action | When | What goes in before / after / reason |
|---|---|---|
| `LOGIN` / `LOGIN_FAILED` / `LOGOUT` | Login screen, log out | username tried (failed), IP |
| `ORDER_CREATE` | Sale completed (any method) | bill no., total, method, item count |
| `DISCOUNT_APPLIED` | Sale with a discount | typed value, applied amount, subtotal |
| `PROMPTPAY_RECEIVED` | Bill marked received (single or bulk, one entry per bill) | bill no., amount |
| `PROMPTPAY_RECEIVED_UNDO` | Received undone | bill no., reason |
| `ORDER_VOID` | Bill voided | bill no., total, method, reason, note |
| `PRODUCT_CREATE` | Add new item saved | all fields, starting stock |
| `PRODUCT_UPDATE` | Edit item saved (non-price fields) | changed fields before → after |
| `PRICE_CHANGE` | Selling price or unit cost changed | old → new price / cost |
| `PRODUCT_DEACTIVATE` / `PRODUCT_REACTIVATE` | Deactivate item / turn back on | product, reason (optional) |
| `CATEGORY_CREATE` / `CATEGORY_UPDATE` | "+ New category" or rename | name before → after |
| `STOCK_RESTOCK` | Restock modal saved (one entry per restock, rows listed) | products, qty each, note |
| `STOCK_ADJUST` | Adjust stock saved | product, mode, qty, before → after stock, reason, note |
| `CUSTOMER_CREATE` / `CUSTOMER_UPDATE` | "+ Add customer", new customer at checkout, edit | name, phone |
| `CREDIT_CHARGE` | Credit sale | customer, bill no., amount |
| `CREDIT_REPAYMENT` | Record payment | customer, amount, method, balance before → after |
| `CREDIT_CHARGE_VOID` | Credit bill voided | customer, bill no., amount, balance before → after |
| `USER_CREATE` / `USER_UPDATE` / `USER_DEACTIVATE` | Users page | changed fields (never the password) |
| `ROLE_CHANGE` | Role changed | role before → after |
| `SETTINGS_UPDATE` | Settings saved | changed settings before → after |
| `TERMINAL_CREATE` | "+ Add terminal" on Settings | code, name |
| `REPORT_GENERATED` | Nightly report saved | report date, totals |
| `REPORT_SENT_LINE` | Sent to LINE (auto, manual "Send to LINE", or Resend) | report date, trigger (auto/manual/resend), success or error |

Action names live in one TypeScript constant (`apps/api/src/audit/actions.ts`) so code and the future Activity screen use the same list.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS + own components in `components/ui` (Radix primitives via `radix-ui` for dialogs, menus, popovers), Royal minimal palette, Prompt font (see section 9) |
| Server state | TanStack Query |
| Cart state | Zustand |
| Routing | React Router |
| Backend | Node.js + Express + TypeScript |
| Validation | Zod (shared between web and API) |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL on Supabase |
| Auth | JWT access token + refresh token (httpOnly cookie), bcrypt |
| Scheduler | node-cron (see hosting risk below) |
| LINE | LINE Messaging API (push to group) |
| Testing | Vitest (+ Supertest for API) |
| Repo | pnpm workspaces monorepo |

---

## 4. Hosting

| Part | Host |
|---|---|
| Frontend | Vercel |
| Backend | Render (Web Service) |
| Database | Supabase (PostgreSQL) |

### Hosting notes and risks
1. **Render free instances sleep when idle.** A sleeping server can't run node-cron, so the auto report would be missed. Options:
   - Paid Render instance (always on), or
   - Render Cron Job service calling the report job, or
   - Supabase `pg_cron` + `pg_net` calling a protected `POST /internal/reports/daily` endpoint
   Decide before step 11. Build the report as a callable function + protected endpoint either way, so the trigger can be swapped.
2. **Supabase connections**: use the Supabase pooler connection strings. Pooled URL for the running app, session/direct URL for migrations. Verify the exact Prisma 7 + Supabase setup in both docs during step 1.
3. **Supabase Data API exposure**: tables Prisma creates in the `public` schema can be reachable through Supabase's auto-generated API. Since only the backend talks to the DB, **enable RLS on every table with no policies** (or disable the Data API / use a separate schema). Add this to the first migration.
4. **Vercel ↔ Render cross-site**: configure CORS for the Vercel domain only. Refresh cookie needs `SameSite=None; Secure`.
5. **Region**: pick Singapore (or nearest) for Render and Supabase to keep latency low from Thailand.

### Environment variables
**API (Render)**
```
DATABASE_URL=            # Supabase pooled URL (app runtime)
DIRECT_URL=              # Supabase session/direct URL (migrations)
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
CORS_ORIGIN=             # Vercel URL
LINE_CHANNEL_ACCESS_TOKEN=
LINE_GROUP_ID=
REPORT_CRON=             # fallback only; the real time comes from ShopSetting.reportTime
REPORT_TIMEZONE=Asia/Bangkok
INTERNAL_JOB_SECRET=     # protects /internal/* endpoints
```

**Web (Vercel)**
```
VITE_API_URL=            # Render URL
```

---

## 5. Project structure

```
pos-system/
├─ apps/
│  ├─ web/                       # React frontend (Vercel)
│  │  └─ src/
│  │     ├─ app/                 # router, navigation config, query client
│  │     ├─ pages/               # one file per route (Login, Checkout, Stock, ...)
│  │     ├─ components/
│  │     │  ├─ ui/               # Button, TextField, Dialog, Alert, EmptyState, ...
│  │     │  └─ layout/           # AppLayout, Sidebar (right), PageHeader
│  │     ├─ features/            # auth, cart, checkout, credit, ... (store + api + components per feature)
│  │     ├─ lib/                 # http client, api instance, config, error messages
│  │     └─ main.tsx
│  └─ api/                       # Express backend (Render)
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  ├─ migrations/
│     │  └─ seed.ts
│     ├─ prisma.config.ts
│     └─ src/
│        ├─ modules/             # one folder per feature
│        │  ├─ auth/             #   auth.routes.ts, auth.service.ts, tokens, cookies, password
│        │  ├─ users/
│        │  ├─ products/
│        │  ├─ categories/
│        │  ├─ inventory/
│        │  ├─ orders/           #   checkout + void transactions
│        │  ├─ credit/
│        │  ├─ reports/
│        │  └─ settings/
│        ├─ audit/               # audit() helper + action constants
│        ├─ jobs/                # daily report job
│        ├─ integrations/        # line.ts
│        ├─ middleware/          # auth, requireRole, validate, errors
│        ├─ lib/                 # prisma client, logger, time (Bangkok)
│        └─ app.ts / server.ts
├─ packages/
│  └─ shared/                    # Zod schemas, types, money + discount utils
├─ plan.md
├─ pnpm-workspace.yaml
└─ package.json
```

---

## 6. Data model (summary)

Full schema in `apps/api/prisma/schema.prisma`.

| Model | Purpose |
|---|---|
| `User` | Login, role, last login |
| `Session` | Refresh-token sessions (hash only), for rotation and logout |
| `Terminal` | Checkout device, bill number prefix + sequence |
| `Category` | Product grouping |
| `Product` | Catalog + cached stock |
| `StockMovement` | Every stock change (sale, restock, adjust, void return) |
| `Order` | Bill: totals, discount, payment, PromptPay pending/received, void info |
| `OrderItem` | Line items with name/price snapshots |
| `Customer` | Credit customers |
| `CreditEntry` | Credit ledger (charge / repayment) |
| `DailyReport` | Frozen report snapshot + LINE send status |
| `ShopSetting` | Single-row shop settings (name, phone, report time, LINE on/off, default low-stock alert) |
| `AuditLog` | Append-only activity log |

---

## 7. API endpoints

```
Auth
  POST   /auth/login
  POST   /auth/refresh
  POST   /auth/logout
  GET    /auth/me

Users (Admin only; the role is re-checked in the database, so a demoted admin loses access at once)
  GET    /users
  POST   /users                   (display name, username, role, password)
  PATCH  /users/:id               (display name, username, role)
  POST   /users/:id/deactivate    (not yourself; never the last active admin; ends their sessions)
  POST   /users/:id/reactivate
  POST   /users/:id/reset-password (ends their sessions)

Categories
  GET    /categories
  POST   /categories
  PATCH  /categories/:id

Products
  GET    /products?search=&categoryId=&status=active|inactive|all
  GET    /products/barcode/:code
  GET    /products/:id
  POST   /products                (with startingStock → INITIAL movement)
  PATCH  /products/:id            (no stock here; PRICE_CHANGE / PRODUCT_UPDATE audit)
  POST   /products/:id/deactivate (reason optional)
  POST   /products/:id/reactivate

Settings
  GET    /settings                (everyone: forms need the defaults)
  PATCH  /settings                (admin; whole form; SETTINGS_UPDATE lists only what changed)

Inventory
  POST   /inventory/restock       (body: items[{productId, qty}], note?; one transaction)
  POST   /inventory/adjust        (body: productId, mode REMOVE|ADD|SET, qty, reason, note?)
  GET    /inventory/movements?productId=&filter=all|sales|restock|adjust&cursor=&limit=
                                  (newest first, with stockAfter per row)
  (Low stock: the Stock page's Low chip uses the product list; reports get their own query in step 11)

Terminals
  GET    /terminals               (active checkout devices with the next bill number; the PC remembers its own)
  POST   /terminals               (admin; code = bill prefix, unique)

Orders
  POST   /orders                  (checkout, requires Idempotency-Key header; same key = same bill)
  GET    /orders?from=&to=&search=&filter=&cursor=   (Bangkok days; filter ALL | CASH | PROMPTPAY | CREDIT | VOIDED; stats per method)
  GET    /orders/:id
  POST   /orders/:id/void         (reason from the chips; note required for "Other")

PromptPay
  GET    /promptpay                      (all pending, any date + received today, oldest first, with stats)
  GET    /promptpay/summary              (pending count for the sidebar badge)
  POST   /promptpay/receive              (body: orderIds[], marks RECEIVED; already-received bills are skipped)
  POST   /promptpay/:orderId/undo        (reason required)

Credit
  GET    /credit                          (every customer with balance + oldest unpaid, stat cards)
  GET    /credit/customers?search=&limit= (with balances; checkout autocomplete uses it too)
  GET    /credit/customers/:id            (history with running balance)
  POST   /credit/customers                (add customer)
  PATCH  /credit/customers/:id            (edit name / phone / note)
  POST   /credit/repayments               (customerId, amount, method CASH | PROMPTPAY, note)

Reports
  GET    /reports/summary?from=&to=       (manual, live)
  GET    /reports/daily                   (saved snapshots)
  POST   /reports/daily/:id/resend-line

Internal (secret header)
  POST   /internal/reports/daily          (scheduled trigger)

Health
  GET    /health
```

---

## 8. Frontend pages

| Page | Who | Notes |
|---|---|---|
| Login | All | Username + password |
| Checkout | All | Barcode input always focused, cart, discount field, payment dialog |
| Payment dialog | All | Cash (change), PromptPay (saves as pending, reminds cashier to point at the printed QR), Credit (customer autocomplete) |
| Bill detail + void (dialog) | All | Items, totals, payment; void with reason (see section 9) |
| Customer credit (dialog) | All | History with running balance; record payment (see section 9) |
| PromptPay check | All | Pending list with amount + time, tick and mark received, badge with pending count in the nav |
| Orders | All | History, bill detail, void with reason |
| Credit | All | Who owes what, history, record repayment |
| Stock (products + inventory) | All | Table with search/scan, All / Low / Out filters, Category filter, Add new item, Restock (top + per row); row menu: Edit item, Adjust, Movement history, Deactivate |
| Reports | All | Manual range report, past auto reports, resend to LINE |
| Users | Admin | Create, edit role, deactivate |
| Settings | Admin | Shop name, report time, terminal |

Target device: **PC screen with keyboard, mouse and barcode scanner** (not touch). Retail focus: checkout is built around the scanner (see section 9).

---

## 9. Design system

**Look:** minimal, blue and white, easy to scan. Palette: **Royal minimal**. Font: **Prompt**.

### Colors

| Token | Hex | Use |
|---|---|---|
| `primary` | `#1D4ED8` | Main buttons, links, top bar, active nav |
| `primary-dark` | `#1E3A8A` | Hover, pressed |
| `primary-tint` | `#DBEAFE` | Selected row, last scanned item, focus ring |
| `page` | `#FFFFFF` | Page background |
| `surface-alt` | `#F9FAFB` | Table stripes, side panels |
| `border` | `#E5E7EB` | Dividers, input borders |
| `text` | `#1F2937` | Main text |
| `text-muted` | `#6B7280` | Labels, hints |
| `success` | `#16A34A` | Received, paid |
| `success-tint` / `success-text` | `#DCFCE7` / `#166534` | Success badge |
| `warning` | `#D97706` | Pending PromptPay, low stock |
| `warning-tint` / `warning-text` | `#FEF3C7` / `#92400E` | Warning badge |
| `danger` | `#DC2626` | Void, delete, out of stock, errors |
| `danger-tint` / `danger-text` | `#FEE2E2` / `#991B1B` | Danger badge |

### Color rules
- Blue means **action or navigation** only. Never use blue for status.
- Status is always green / amber / red, and always paired with a text label or icon (never color alone).
- One solid primary button per screen (Pay, Save). Other buttons are outlined or gray.
- Destructive actions (void, delete) use `danger`, never `primary`.

### Typography
- **Font:** Prompt (Google Fonts, covers Thai + Latin), fallback `"Noto Sans Thai", sans-serif`
- **Weights:** 400 body, 500 labels and buttons, 600 totals and headings

| Use | Size | Weight |
|---|---|---|
| Checkout total | 32px | 600 |
| Page heading | 24px | 600 |
| Section heading | 18px | 500 |
| Body, table rows, inputs | 16px | 400 |
| Buttons | 16px | 500 |
| Labels, hints, badges | 14px | 400–500 |

- Minimum text size 14px; Thai needs line-height around 1.6 so tone marks and vowels don't clip.
- Prompt is a wide font: Thai labels take more room than English. Test every button, table header and nav item with real Thai text, and let product names truncate with an ellipsis.
- Prices are right-aligned. Use `font-variant-numeric: tabular-nums`; check in the browser that digits line up, and if Prompt doesn't support it, keep price columns fixed-width.

### Shape and style
- **Pill style**: buttons, inputs, search bar, filter chips and badges are fully rounded (`rounded-full`).
- Cards and panels: 12–16px radius. Flat surfaces, thin borders (`border`), no heavy shadows.
- Keep the same border width in every state (change color only), so elements don't shift on hover.
- Decorative circles are used on the **login page only**. App pages stay plain white so content is easy to scan.

### App frame (PC)
- Design at **1366 × 768** first, then check at 1920 × 1080.
- Every page (except login and checkout) shares the same frame: page content + **fixed sidebar nav on the RIGHT** (about 300px in the 1440 design). Decision: right side on every page for consistency and because the cashier's mouse mostly works on the right. Checkout uses a hamburger menu instead (see below).
- Keep at least 32px between the rightmost table action column and the sidebar, so row actions and nav items don't crowd each other.
- Sidebar: Checkout, Stock, PromptPay (amber badge with pending count), Credit, Orders, Reports; Users and Settings for Admin only. (No separate Products page in Phase 1.) Logged-in user name + role and Log out (outlined, not red) at the bottom.
- Mouse-sized controls: 36–40px high. Pay button larger.
- Every interactive component has Normal, Hover and Focus states (visible focus for keyboard users).

### Checkout layout
- Two columns: product grid (stretches) | **cart panel fixed on the right** (about 380px). The cart is never hidden.
- On checkout the nav is a **hamburger menu** (top right, next to the search bar) that slides in **from the right**, over the cart, with a dim overlay behind it. Checkout nav item shows as Active. The hamburger turns into ✕ while open; ✕, Esc, or clicking the overlay closes it. Other pages use the fixed sidebar on the right.
- Scan/search bar at the top of the product grid, focused by default.
- Cart panel title: **"Current bill"** (not "Orders", which is the bill history page).
- Item rows: name, `− qty +`, line total (unit × qty), remove (✕, or qty below 1 removes the row). Column headers without colons.
- **Qty buttons (fix in code):** the Figma prototype uses solid blue circles; build them as **small outlined buttons** (about 28px, `border` color outline, `text` icon, `primary` outline on hover) so the panel stays calm. Minus on the left, plus on the right.
- Totals, in this order:
  - Subtotal
  - Discount: shows "Add discount" when empty; once set shows "−xx THB" with Edit. Opens a small amount input (`F4` too).
  - **Total = subtotal − discount**, large, in `text` color (not green; green means paid).
- Checkout button opens the **payment dialog**, where the cashier picks Cash / QR / Credit (cash: amount received → change).
- Last scanned row in the cart gets `primary-tint`.
- Empty state: "Scan an item to start".

### Scanner and keyboard
- The scanner acts as a keyboard: types the barcode then Enter.
- Scan input is focused on load and focus returns to it after every action. Also listen for scans at page level, so a scan works even if focus moved.
- Scanning an item already in the cart adds +1 instead of a new row.
- Unknown barcode: clear red message + beep.
- Shortcuts (shown on the buttons): `F2` search, `F4` discount, `F9` pay, `Esc` cancel/close, `Del` remove selected row. Cash dialog: type amount received → Enter shows change → Enter completes.

### Components

**Item card (checkout grid)**
- Content: product name (2 lines max, then ellipsis), stock badge, price with ฿. No image by default; image optional for items without barcodes.
- Variant properties: `State` = Normal / Hover / Selected, `Stock` = Normal / Low / Out.
  - Hover: `primary` border. Selected (last scanned): `primary-tint` background + `primary` border.
- Out of stock is **still clickable/sellable** (stock may be wrong; negative stock is flagged), but asks "Add anyway?" first (see Business rules → Stock). It shows the red badge; don't dim it when Selected.

**Stock badge**
- Pill with a colored dot + label. Dot uses the mid color, text uses the dark shade on the tint:
  - Normal: `success` dot, `success-text` on `success-tint` — "Available : {count}"
  - Low: `warning` dot, `warning-text` on `warning-tint` — "Low : {count}"
  - Out: `danger` dot, `danger-text` on `danger-tint` — "Out of Stock"
- Text 16px in the item card. Badge should hug its content (no fixed width).

**Filter chip**
- Pill with label + count, e.g. "Low (6)". Selected: `primary` border + `primary-dark` text.

### Stock page (table)
- Top: page title (24px), search bar ("Search name, SKU, or scan barcode", left-aligned, with icon), filter chips All / Low / Out with counts, Category filter (dropdown chip), "Add new item" (secondary) and `Restock` (primary).
- Columns: Product | SKU | Stock | Price | Actions.
- **Alignment (apply in code):**
  - Product, SKU, Stock: left-aligned. Price and any money column: right-aligned with tabular numbers.
  - Header and rows use the **same column widths** (a real `<table>` or one shared CSS grid template).
  - Long product names truncate with an ellipsis.
- Row text 14–16px, SKU in `text-muted`.
- Row hover: `surface-alt` (light gray), **not** blue. No selected state on this page.
- Stock cell: plain number when normal; Low / Out badges otherwise. Default sort puts Out, then Low, first.
- Actions: `Restock` link on each row; Adjust and History in a "…" menu.
- Top Restock = empty restock list; row Restock = same modal with that product already in the list.
- Pagination (if used): pill buttons with ‹ ›, "Page 1 of N", Back disabled on page 1. For a few hundred products, search + filters may be enough without paging.
- Empty state when search/filter finds nothing.

**Login page**
- Centered card on white; "Welcome" title; decorative circles (blue, navy, amber) are allowed **only on this page**.
- Fields: Username and Password with labels **above** the inputs (no "Username........" placeholders), pill inputs per the input style; password has a show/hide eye icon.
- Login button: primary pill, **white** text. Enter submits. Error under the form: "Wrong username or password." (never say which one).
- Locked or inactive user: "This account is turned off. Ask the admin."
- Logs `LOGIN` / `LOGIN_FAILED` to the audit log.

**Payment dialog (Figma: `Payment Dialog` + `Payment Method`)**
- Opens from Checkout (button or `F9`). Medium dialog (920 Figma / ≈ 600 code).
- Header: "Payment · 4 items" + the **total, large**; close ✕.
- Method cards: Cash / PromptPay / Credit with key badges `1` `2` `3` (option-card style). Cash selected by default.
- **Cash**: "Amount received" field focused; quick chips: Exact, then the next banknotes above the total (e.g. 50 / 100 / 500 / 1,000); **Change** shown large in a result box. If received < total: red "Short by 5.00 ฿" under the field and the confirm button is disabled.
- **PromptPay**: QR icon, "Ask the customer to scan the shop QR at the counter, and pay exactly", the amount large; amber note "The bill is saved as Pending. Check the bank app later and mark it received on the PromptPay page."
- **Credit**: "Customer name" with autocomplete; each suggestion shows what that person already owes; last option "+ New customer "{typed}""; result box "Somchai will owe 250.00 → 280.00 ฿".
- Footer: Cancel (`Esc`) and primary button whose label matches the method: **Complete sale** / **Save as pending** / **Add to credit** (`Enter`).
- Keyboard: `1` `2` `3` switch method, `Enter` confirms, `Esc` cancels. Fast cash flow: scan, scan, `F9`, type 100, `Enter`.
- **Success state (approved)**: replaces the dialog body.
  - Cash: green check, "Sale completed", "Bill T1-000125 · Cash · 30.00 ฿", result box "Give change **70.00 ฿**" (+ "Received 100.00 ฿").
  - PromptPay: amber clock icon, "Saved as pending", amber note "Check the bank app later and mark it received on the PromptPay page."
  - Credit: green check, "Added to Somchai's credit", result box "Somchai now owes 280.00 ฿".
  - Primary **New sale** button, focused with a visible ring (`Enter` clears the cart and returns focus to the scan box). Text link: View bill (no Print receipt in Phase 1). "Closes in 5 s" countdown; any key or scan also closes it and starts the next sale.
- Saving uses the idempotency key so a double Enter can't create two bills.

**Users page (Admin only, approved)**
- Header: "Users" + "Who can log in, and what they can do"; primary "+ Add user".
- Table: Name (initial avatar, "(you)" for the current user) | Username | Role badge (Admin: dark `#1F2937` with white text; Cashier: neutral gray) | Status (green "Active" / gray "Turned off") | Last login | "…" menu (Edit, Reset password, Turn off / Turn on).
- Turned-off users stay in the list, grayed out; they can't log in. Users are never deleted (audit history points to them).
- Rules: you can't turn yourself off or remove your own Admin role; there must always be at least one active Admin.
- **Add / Edit user dialog**: Display name*, Username* (letters and numbers, unique, "Used to log in"), Role* segmented Cashier / Admin with a one-line explanation of each, Password* + Confirm* (min 8, show/hide) on Add only. Edit has no password fields; "Reset password" is a separate small dialog that sets a new password.
- Footer: Cancel, primary "Add user" / "Save changes".

**Settings page (Admin only, approved)**
- Header: "Settings" + "Shop details, daily report and devices". Sections as cards with a title + one-line description on the left and fields on the right:
  - **Shop**: Shop name* (shown on receipts and in the LINE report), Phone (optional).
  - **Daily report**: Report time* (time field, e.g. 22:00), Send to LINE (on/off toggle), LINE status box (green "Connected · group name" or red "Not connected" + what to check) with secondary "Send test". Note: "The LINE token is set on the server, not here." (secrets stay in env vars).
  - **Terminals**: list of terminals (code · name), "This PC" badge on the current device, "Next bill T1-000126"; "+ Add terminal" (code + name). A PC becomes a terminal when an admin picks it once on that PC (saved in the browser); checkout needs a terminal set.
  - **Stock**: Default low-stock alert (pcs), pre-filled into Add new item.
- Unsaved-changes bar at the bottom: "You have unsaved changes", Discard, primary "Save changes". Saving writes `SETTINGS_UPDATE` with before → after.

**Schema changes from these designs (done)**
- `ShopSetting` model, a single row (`id = 1`): `shopName`, `shopPhone`, `reportTime` ("HH:mm", Bangkok), `sendReportToLine`, `defaultLowStockAt`. Seeded in step 1. Secrets stay in env vars.
- `User.lastLoginAt`, set on successful login.

**Sidebar (Figma component `Sidebar`, uses `Nav Item`)**
- 300px wide, sits on the right with a 2px border on its left edge; logo, nav items with icons: Checkout, Stock, PromptPay (amber pending badge), Credit, Orders, Reports; "Admin" section with Users, Settings (admins only); user name + role and outlined Log out at the bottom.
- Nav Item states: Default / Hover (light gray) / Active (`primary-tint`, dark blue text). Labels are one line, truncate if too long.

**PromptPay check page (designed in Figma: `PromptPayPage`, `PromptPay Row`)**
- Header: title + "Match each bill with your bank app, then mark it received."
- Two stat cards: Pending (amber, count + total) and Received today (green, count + total).
- Filter pills: Pending (n) / Received today (n) / All. Default sort: oldest first.
- Table grouped by day ("Yesterday · 1 bill", "Today · 3 bills"). Columns: checkbox | Time | Bill | Amount (right) | Cashier | action.
- Row states: Pending, Selected (`primary-tint`, checked), Received (green "Received 14:40 · Nok" badge + undo icon).
- **Same amount tag** (amber) when two pending bills have the same amount close in time, so staff match them carefully.
- Each row has an outlined "Mark received" button; selecting rows shows a bulk bar at the bottom: "2 selected · 875.00 ฿", Clear, primary "Mark 2 as received".
- Undo on a received bill asks for a reason (audit `PROMPTPAY_RECEIVED_UNDO`).

**Orders page (approved)**
- Header: "Orders" + "Every bill, with its payment and status". Sidebar on the right with Orders active.
- Search: bill no. or customer name. Date chip (Today ▾ → Today / Yesterday / pick a date or range).
- Filter chips: All / Cash / PromptPay / Credit, plus a separate "Voided (n)" chip.
- Summary strip for the current filter: bill count, sales total, PromptPay pending count (amber), voided count (red).
- Table, newest first: Time | Bill | Items (count) | Payment | Total (right) | › chevron. Whole row is clickable and opens Bill detail.
  - Payment cell: "Cash"; "PromptPay" + Pending (amber) or Received (green) badge; "Credit · {customer}".
  - Voided bills stay in the list: gray text, red "Voided" badge, total struck through. Excluded from sales totals.
- Paging: load more on scroll or "Load more" (bills only for the selected date range).

**Bill detail dialog (approved)**
- Medium dialog. Header: "Bill T1-000124" + status badge (Completed green / Voided red) + "Today 14:32 · Cashier Nok · Terminal T1".
- Item list: name, "qty × unit price" underneath, line total right (from the order item snapshots).
- Totals: Subtotal, Discount (−), large Total.
- Payment box: method, and for PromptPay the Pending/Received badge with a "Mark received" link; for Credit the customer name with a link to their credit page; for Cash the amount received and change.
- Voided bills also show who voided, when, reason and note.
- Footer: "Void bill" (red text, left; hidden if already voided), Close (secondary). No Reprint in Phase 1.
- **Void step** (same dialog, body swaps): red banner explaining the effect ("Voiding returns 37 pcs (4 items) to stock and cancels the pending PromptPay payment. The bill stays in the list as Voided."), Reason* chips (Wrong items, Customer changed mind, Payment not received, Duplicate bill, Other), optional note. Footer: ← Back, solid red "Void bill".
- Effect (one transaction, as in the Void rules): status VOIDED, VOID_RETURN movements, credit charge reversed if credit, PromptPay pending cancelled, `ORDER_VOID` audit entry.

**Credit page (approved)**
- Header: "Credit" + "Who owes the shop, and how much"; secondary "+ Add customer" button (name, optional phone and note).
- Stat cards: Total owed (amber: amount + number of people) and Collected today (green: amount + number of payments).
- Search by name or phone. Chips: "Owes money (n)" (default) / "All (n)". Sort: Highest first ▾ (or Oldest debt).
- Table: Customer (initial avatar, name, phone if any) | Owes (right, SemiBold) | Oldest unpaid (age; amber badge when 30+ days) | "Record payment" (secondary pill). Row click opens the customer dialog.

**Customer credit dialog (approved)**
- Header: name + "On credit since 8 Sep · 5 credit bills".
- "Owes now" amber box with the balance.
- History table, newest first: Date | What | Amount | Balance (running).
  - Credit sale + bill link (+), Payment · Cash/PromptPay (green badge, −), Voided + bill link (gray, −).
- Footer: phone (if any), Close, primary "Record payment".
- **Record payment step** (body swaps): Amount paid* (focused, ฿) with quick chips (Full {balance}, 100, 200, 300, 500); Paid with* (Cash / PromptPay); result box "Somchai will owe 780.00 → 480.00 ฿"; note "Can't be more than what they owe. Counts as money received today, not as a new sale." Footer: ← Back, primary "Record 300.00 ฿ payment".
- A PromptPay repayment is recorded after the staff member has checked the bank app (no pending state for repayments in Phase 1).

**Schema changes from this design (done)**
- `CreditEntry.method` (`RepaymentMethod`: CASH / PROMPTPAY) on repayments, so reports can split repayments by how they were paid.
- `CHARGE_VOID` credit entry type for voided credit bills: lowers the balance without counting as money received.
- `CreditEntry.orderId` is no longer unique on its own; `@@unique([orderId, type])` allows one CHARGE and one CHARGE_VOID per order. `Order.creditEntry` became `Order.creditEntries`.

**Reports page (approved)**
- Header: "Reports" + "Sales and money for any day or range"; secondary "Send to LINE" (sends the currently shown summary).
- Tabs: **Summary** (live, any range) / **Daily reports** (saved nightly snapshots).
- **Summary tab**
  - Range chips: Today / Yesterday / This week / This month / Custom ▾ (date picker). Range label on the right, e.g. "Mon 12 Oct · 00:00–now" (Bangkok day boundaries).
  - Four metric cards (`surface-alt`, label + large value + small note): Net sales (+ bill count), Money received, Discounts (+ bills with discount), Voided (red value + count).
  - Panel "Sales by payment": Cash / PromptPay / Credit with amount, % and a light-blue bar; under PromptPay, green "received" and amber "pending" badges.
  - Panel "Money received": Cash sales, PromptPay received, Credit repaid · cash, Credit repaid · PromptPay, **Total received**, then "Cash that should be in the drawer" (cash sales + cash repayments; no opening float in Phase 1).
  - Panel "Top products": top 5 by amount (toggle by quantity), showing qty and amount.
  - Panel "Low stock": Out and Low items with badges, link "Open Stock".
  - Numbers: Net sales = gross − discounts, voided bills excluded. Money received = cash sales + PromptPay marked received + `REPAYMENT`s (by method). `CHARGE_VOID` never counts.
- **Daily reports tab**
  - Note: "Saved every night at {report time} and sent to the shop LINE group".
  - Table: Date | Net sales | Received | LINE status (green "Sent 22:00" / red "Failed" + Resend). Row opens the saved report in the same layout as Summary, read-only.
  - Saved reports are frozen snapshots (`DailyReport.data`); a later void does not change them.
- **LINE message format** (plain text, one message):
  ```
  📊 Daily report · Sun 11 Oct
  Net sales: 6,210.00 ฿ (45 bills)
  • Cash 3,890.00
  • PromptPay 1,750.00 (pending 230.00)
  • Credit 570.00
  Money received: 5,980.00 ฿
  Cash in drawer: 4,140.00 ฿
  Discounts 85.00 · Voided 1 (40.00)
  ⚠️ Low stock: Soy milk (0), Cooking oil (3)
  Sent by POS at 22:00
  ```
  Low stock line lists up to 5 items, then "+ n more". Thai version can replace the labels later.

**Add new item modal**
- About 720px wide, `max-height: 90vh`; header and footer fixed, only the fields scroll.
- Sections: Item details (Barcode*, Item name*, Category, SKU with Auto), Price (Selling price* ฿, Unit cost ฿, profit hint), Stock (Starting stock* pcs, Low-stock alert pcs). Live item-card preview on the right.
- Category and Unit cost are optional (match the schema). SKU auto-generated when left empty.
- Category dropdown: searchable list of existing categories, with a **"+ New category"** option at the bottom. Choosing it turns the dropdown into a small inline input (name + Add); on save it creates the category (`POST /categories`), selects it, and keeps the rest of the form as typed. Category names are unique; a duplicate shows an inline error. Prefill the new-category input with whatever was typed in the search.
- Barcode focused on open (blue border). Duplicate barcode shows an inline error naming the existing product.
- Footer: Cancel (gray text), Save and add another (outlined), Save (primary). Esc and ✕ close.

**Stock row "…" menu (Figma: `Stock Row Menu`)**
- Edit item, Adjust stock, Movement history, divider, Deactivate item (red). Deactivate hides the item from checkout and keeps all history; it asks for confirmation.

**Edit item dialog (Figma: `Edit Item Dialog`)**
- Same sections as Add new item, pre-filled: Item details (Barcode*, SKU, Item name*, Category), Price (Selling price*, Unit cost, profit hint), Stock.
- Note under price: "A new price applies to new sales. Past bills keep the old price." (order items already snapshot price).
- **Current stock is read-only** here, with Restock and Adjust links. Stock only changes through movements.
- Low-stock alert is editable. Live item-card preview on the right.
- Footer: Deactivate item (red, left), Cancel, Save changes (primary). Price change writes `PRICE_CHANGE` to the audit log; other edits `PRODUCT_UPDATE`.

**Adjust stock dialog (approved; Figma build pending)**
- Header: "Adjust stock" + product name, SKU and current stock.
- Mode switch (segmented pill): **Remove** / **Add** / **Set count**.
  - Remove: quantity to remove*, reason* chips (Damaged, Expired, Lost or stolen, Used in store, Other).
  - Add: quantity to add*, reason* chips (Found extra, Customer return, Other); hint "For a new delivery, use Restock instead."
  - Set count: "Counted on the shelf"*; the system calculates the difference; reason saved as "Count correction".
- Optional note. Result box: "24 → 21 pcs" (Set count shows "Difference −3 pcs").
- Confirm button says what happens: "Remove 3 pcs" / "Add 2 pcs" / "Set stock to 21".
- Saves one `ADJUST` movement (signed qty, reason + note in `reason`) and `STOCK_ADJUST` audit entry in one transaction. Qty must be a whole number > 0; Set count can't be negative. Removing more than current stock is allowed but warns ("Stock will go below 0").

**Movement history dialog (approved; Figma build pending)**
- Header: "Movement history" + product name, SKU, current stock.
- Filter pills: All / Sales / Restock / Adjust. Newest first, grouped by day, "Load older" at the bottom.
- Columns: Time | Type | Change (signed, right) | After (stock after, right) | By | Details.
- Type badges: Sale and Void return neutral gray; Restock and Opening stock green; Adjust amber. (No blue badges: blue stays for actions.) Positive change in green text, negative in dark text.
- Details: bill number links to the bill (sale, void return); supplier/invoice note for restock; reason + note for adjust; "Item created" for opening stock.
- Read-only. API: `GET /inventory/movements?productId=` (already listed) should return stock-after per row (running total) and user name.

**Restock modal (batch, design approved)**
- Same frame as Add new item: header (title, hint "Scan each product as you unpack the delivery", ✕), fixed footer, scrolling body.
- Scan/search box at the top, focused on open.
- List of products being restocked, columns: Product | Now | Add | New | remove ✕.
  - "Now" keeps its stock color (red for 0, amber for low). "New" = Now + Add, shown bold.
  - Last added/scanned row gets `primary-tint` and its Add field is focused.
- Scanning a product adds it with qty 1; scanning it again adds +1 (same rule as the cart).
- Unknown barcode: "Not found" + **Add as new item** button, which opens the Add new item modal with the barcode pre-filled; after saving, the new product is added to the restock list.
- Optional note (supplier / invoice number), saved in each movement's `reason`.
- Footer: summary "N products · X pcs" on the left; Cancel (gray) and primary "Restock N items" on the right. Button disabled when the list is empty.
- Qty must be a whole number > 0 (corrections go through Adjust).
- Closing with items in the list asks "Discard this restock?".
- Save: one `RESTOCK` movement per row + `stockQty` updates + `STOCK_RESTOCK` audit entry, all in one transaction. Show "Restocked 3 items" toast and refresh the table.
- Not in Phase 1: updating cost price per delivery, pack sizes (1 case = 24 pcs).

### Component styles (shared by all screens)

**Scale between Figma and code.** The Figma frames are 1440 × 1024 and drawn at about **1.5× the size the browser should show**. In code, divide Figma sizes by 1.5 and round to the type scale above: 24px Figma body → 16px, 22px labels → 14px, 60px inputs → 40px, 300px sidebar → 200px. Values below are **Figma values**, with the code value in brackets.

**Dialogs (modals)**
- Overlay: `rgba(15, 23, 42, 0.45)` over the page. Click on overlay or Esc closes (asks first if there is unsaved work).
- Shell: white, radius 32 (≈ 20), clips content. Widths: 760 small (Adjust stock, Restock), 920 medium (Payment), 1100 large with preview (Add / Edit item). Max height 90vh; header and footer fixed, body scrolls.
- Header: padding 24–28 top, 16–20 bottom, 36 sides. Title 40 SemiBold `text`; subtitle 22 Regular `text-muted` (product name · SKU · current stock, or "Payment · 4 items"). Close ✕ icon 36, `text-muted`, top right.
- 2px `border` dividers under the header and above the footer.
- Body: padding 20–28 top/bottom, 36 sides; 20–24 between blocks.
- Footer: `surface-alt` background, padding 16–20 / 36, gap 16. Right side: Cancel (text button) then one primary button whose label says exactly what happens ("Remove 3 pcs", "Save as pending", "Restock 3 items"). Left side (optional): destructive text action in red with icon (Deactivate item) or a summary ("3 products · 72 pcs").
- Section titles inside dialogs: 26 SemiBold `text-muted` (Item details, Price, Stock).

**Buttons**
- Primary: pill, `primary` fill, white 24 Medium text, padding 16 / 36. One per screen or dialog.
- Secondary: pill, white fill, 2px `primary` border, `primary` text (Save and add another, Mark received, Add new item).
- Text button: no border, 24 Medium `#4B5563` (Cancel, Clear).
- Destructive: red `danger` text + icon, no fill (Deactivate item); a solid red button only inside a confirm step (Void bill).
- Keyboard hint badge inside or next to a button: white, 2px `#9CA3AF` border, radius 8, 20 Medium `#374151` ("Esc", "Enter", "1/2/3", "F9").

**Inputs**
- Pill (radius full), padding 13 / 24 (≈ 40px tall in code), `surface-alt` fill, 3px `border` stroke inside. Value 24 Regular `text`; placeholder `#9CA3AF`.
- Units inside on the right in `text-muted`: ฿ for money, pcs for quantities. Dropdowns show a chevron icon.
- **Focus**: white fill + 4px `primary` stroke (not a blue fill).
- Read-only: `#F3F4F6` fill, same border; may hold text links on the right (Restock · Adjust).
- Labels above the field: 22 Medium `text`; optional fields' labels in `text-muted` or with "(optional)" in Regular `text-muted`; required marked with a red `*`.
- Hint / helper line under a field: info icon 20–22 + 20 Regular `text-muted`. Errors: same place, `danger` text.

**Choice controls**
- Chips (reasons, quick cash amounts, filters): pill, padding 8 / 20, 2px `#D1D5DB` border, white, 22 Medium `text`. Selected: `primary-tint` fill, `primary` border, `primary-dark` text. Filter chips show counts: "Pending (4)".
- Segmented control (Adjust stock modes): `#F3F4F6` pill track with 6 padding; equal-width options with icon + label; selected option white with 2px `primary` border and `primary-dark` SemiBold text.
- Option cards (payment methods): 272 × 120, radius 24, icon 40 + label 28 Medium + key badge. Default 3px `#D1D5DB` border; Hover `primary` border; Selected `primary-tint` fill + `primary` border + check icon top right.

**Result / summary boxes**
- `surface-alt` fill, 2px `border`, radius 24, padding 18 / 28. Label left 26 Medium; value right, large 40–56 SemiBold, with the "before →" part in Regular `text-muted` ("24 → 21 pcs", "Change 70.00 ฿", "250.00 → 280.00 ฿").

**Banners and stat cards**
- Notice banner: radius 24, padding 20 / 24, status tint background with matching dark text and a dot (e.g. amber "The bill is saved as Pending…").
- Stat cards (PromptPay page): status tint background, radius 24, padding 14 / 24, label 22 Medium + value 30 SemiBold in the dark status color.

**Badges**
- Status badge: pill with colored dot + label, tint background + dark text (Available / Low / Out of stock, Received, Pending).
- Count badge (nav): amber tint pill, 20 SemiBold `warning-text`.
- Tag (inline warning): small amber pill, 18 Medium ("Same amount").
- Movement type badges: Sale and Void return neutral (`#F3F4F6` / `#374151`); Restock and Opening stock green; Adjust amber. Never blue.

**Tables**
- Header row: 20 Medium `text-muted`, 2px `border` bottom line.
- Rows: padding 14 / 20, 2px `border` bottom line, text 24 (`text`), secondary columns in `text-muted`. Money right-aligned, SemiBold, tabular numbers.
- Hover: `#F3F4F6`/`surface-alt`. Selected (checkbox rows): `primary-tint`.
- Group headers by day: 20 SemiBold `text-muted` ("Today · 3 bills").
- Checkbox: 28, radius 8, 2px `#9CA3AF` border; checked = `primary` fill + white check.
- Bulk action bar when rows are selected: pill bar at the bottom, `surface-alt` + border, "2 selected · 875.00 ฿", Clear, primary action.

**Menus**
- "…" row menu: white, radius 20, 2px `border`, shadow `0 8px 24px rgba(15,23,42,0.12)`, padding 8. Items: icon 24 + 22 Medium label, padding 12 / 16, radius 12, hover `#F3F4F6`. Destructive item last, below a divider, in `danger`.

**Sidebar**
- 300 wide (≈ 200), white, 2px `border` on its left edge, on the right side of the screen.
- Nav item: 268 wide, radius 16, icon 28 + label 24 Medium, one line; Hover `#F3F4F6`; Active `primary-tint` + `primary-dark` SemiBold.

**Icons**
- Tabler Icons, outline, stroke 2 (in code: `@tabler/icons-react`). Sizes: 20–24 inline, 28 nav, 36 close button, 40–80 for feature icons in dialogs. Default color `#4B5563`; take the text color of the element they sit in.

**Figma status**
- Built as components: Item Block, Stock Badge, Payment Method, Payment Dialog, Sidebar, Nav Item, PromptPay Row, Stock Row Menu, Edit Item Dialog.
- Adjust stock and Movement history are pasted preview images in Figma for now; rebuild as components later (the spec above and in "Components" is the source of truth).

### States and feedback (approved)

**Discount input (cart "Add discount" or `F4`)**
- Small popover anchored to the cart's discount line: "Discount" title, amount field (focused, ฿), quick chips 5 / 10 / 20 / 50, preview "Total 40.00 → 30.00 ฿".
- Note when the discount is larger than the bill: "If more than the bill, it's capped so the total is 0.00".
- Footer: Remove (red text, only when a discount exists), Cancel, primary Apply. `Enter` applies, `Esc` cancels.

**Unknown barcode (checkout and restock)**
- Scan box border turns red; red banner under it: "Barcode not found — 8850999000111 isn't in the system yet." with "+ Add as new item" (opens Add new item with the barcode filled) and "Esc to dismiss".
- Plays an error beep. Scan box clears and keeps focus; the banner hides on the next good scan.

**Empty states** (icon + one bold line + one gray line + optional link)
- Cart: "Scan an item to start" / "or search by name, or click a product"; Checkout button disabled (gray).
- Search with no results: "No items match "{query}"" / "Check the spelling or scan it" + "+ Add new item".
- PromptPay: "All caught up" (green check) / "No PromptPay bills waiting to be checked".
- Credit: "Nobody owes money" / "Credit sales will show up here".
- Orders: "No bills yet today" + "Go to Checkout". Same pattern for any empty table.

**Loading**
- Tables and lists show 3–5 gray skeleton rows; buttons that save show a spinner and stay the same width; never block the whole screen.

**No internet connection (online-first)**
- Red banner across the top of every page: "No internet connection. Sales can't be saved until it's back. Your cart is kept. Retrying…".
- Checkout button disabled with label "Checkout · waiting for internet"; the cart stays in memory (and in local storage) so nothing is lost.
- The app checks the connection every few seconds; when it's back, the banner goes and a "Back online" toast shows for 3 s.
- Any save that fails mid-request shows the error toast with Retry; the idempotency key makes the retry safe.

**Toasts**
- Bottom left (away from the cart and the right sidebar). Pill shape.
- Success: dark `#1F2937` background, white text, green check; optional action link ("View"); hides after 4 s.
- Error: white background, 2px red border, red text, "Retry" when the action can be retried; stays until closed.
- One at a time; a new toast replaces the old one.

**Confirm dialogs** (small dialog, about 480 Figma / 320 code)
- Icon circle (tint + colored icon), bold question as the title, one or two lines explaining what will happen.
- Destructive: Cancel + solid red button named after the action ("Deactivate"). Used for Deactivate item, Turn off user.
- With reason: same, plus a required Reason field; primary button stays blue unless the action is destructive. Used for Undo received.
- Discard work: "Keep editing" + outlined red "Discard". Used when closing Restock, Add/Edit item or Settings with unsaved changes.
- `Esc` = Cancel. Focus starts on the safe button (Cancel / Keep editing).

**Session expired**
- Small dialog over the current page: "Please log in again — You were logged out for security. Your cart is still here." Password field for the same user, "Switch user" link, primary "Log in". After login the page and cart continue as they were.

**No permission**
- Cashier opening an admin page (Users, Settings) sees an empty-state page: lock icon, "Only admins can open {page}", "Ask an admin if you need something changed here.", outlined "Back to Checkout". The API also returns 403, so hiding the nav item is not the only guard.

### Tailwind setup (v4, `apps/web/src/index.css`)
```css
@import url("https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600&display=swap");
@import "tailwindcss";

@theme {
  --font-sans: "Prompt", "Noto Sans Thai", sans-serif;

  --color-primary: #1D4ED8;
  --color-primary-dark: #1E3A8A;
  --color-primary-tint: #DBEAFE;

  --color-page: #FFFFFF;
  --color-surface-alt: #F9FAFB;
  --color-border: #E5E7EB;
  --color-text: #1F2937;
  --color-text-muted: #6B7280;

  --color-success: #16A34A;
  --color-success-tint: #DCFCE7;
  --color-success-text: #166534;
  --color-warning: #D97706;
  --color-warning-tint: #FEF3C7;
  --color-warning-text: #92400E;
  --color-danger: #DC2626;
  --color-danger-tint: #FEE2E2;
  --color-danger-text: #991B1B;
}

body {
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-page);
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}
```
Usage: `bg-primary`, `hover:bg-primary-dark`, `text-text-muted`, `bg-warning-tint text-warning-text`.

Components in `apps/web/src/components/ui` use these tokens directly (no shadcn/ui; Radix primitives underneath where focus handling is hard: Dialog, DropdownMenu, Popover).

Use the same token names for Figma color variables so design and code match.

---

## 10. Build order

- [x] **1. Setup**: pnpm monorepo, TypeScript, ESLint/Prettier, Tailwind theme tokens + Prompt font, Supabase project, Prisma 7 config, first migration (+ RLS on all tables), seed (admin user, terminal T1, ShopSetting row, sample products)
  - [x] Code scaffold done 2026-10-12 (monorepo, api, web, shared, Prisma 7 + pg adapter, seed, `pnpm db:init` with RLS, README). Install, typecheck, lint, tests and build pass.
  - [x] On the dev PC (2026-10-12): local PostgreSQL 17 database `pos_dev` for development, `pnpm db:init` + `pnpm db:seed` run, setup page all green.
  - [ ] Supabase project for staging/production: create it and run `pnpm db:deploy` against it before the first deploy (step 13).
  - Dev database decision: local PostgreSQL (not MySQL) so migrations and SQL match Supabase.
  - Pinned versions: Node 22.12+, pnpm 10.34, TypeScript 6.0, Prisma 7.10 (8.0 is still RC), React 19.3, Vite 8, Tailwind 4.3, Express 5, Zod 4, ESLint 10.
- [x] **2. Auth + roles**: login, JWT access/refresh, `requireRole` middleware, audit login events
  - [x] API: login / refresh (rotating) / logout / me, `Session` table, rate limit, client-header guard, error format `{ error: { code, message } }`, audit LOGIN / LOGIN_FAILED / LOGOUT. Unit + Supertest + DB integration tests.
  - [x] Web: API client with refresh-and-retry, auth store, route guards, Login page, right sidebar layout, Session expired dialog, No permission page, placeholder pages, setup check moved to `/setup`.
  - [x] `pnpm db:migrate` now adds row level security to new tables by itself.
- [x] **3. Shared package**: money utils, discount calc, Zod schemas, with unit tests
  - [x] `money.ts`: satang helpers, `parseThb` for typed amounts (string-based, no float rounding), formatting. `pricing.ts`: `calculateBill` (discount capped at subtotal), `calculateCash` (change / short), satang + qty + discount schemas. `time.ts`: Bangkok day keys and day ranges for reports and filters.
  - Feature schemas (product, restock, checkout, ...) are added to `packages/shared` in the step that builds each feature, next to its API.
- [x] **4. Products + categories**: API, barcode lookup, Stock page list + Add/Edit item dialogs (standalone components)
  - [x] API: categories (list with counts, create, rename; unique ignoring case), products (list/search, barcode lookup, create with INITIAL movement, edit with PRICE_CHANGE / PRODUCT_UPDATE showing only changed fields, deactivate / reactivate), auto SKU `SKU-00001`, duplicate barcode/SKU errors name the other item. DB integration tests.
  - [x] Web: Stock page (search + scan, All / Low / Out / Turned off chips with counts, category filter, Out → Low → name order), Add new item (live preview, + New category, Save and add another, discard confirm), Edit item, Deactivate / Turn back on. Filtering is client-side for now (fine for a few hundred items; the API already supports `?search=`).
  - [x] `pnpm user:create` / `pnpm user:reset-password` terminal commands (audit logged as "Terminal (CLI)").
  - Restock, Adjust stock and Movement history (button, row link and menu items) arrive in step 5.
- [x] **5. Inventory**: batch restock modal, adjust, movements, low stock
  - [x] API: restock (one transaction, same item twice is added up, one STOCK_RESTOCK entry listing every row), adjust (row locked, signed ADJUST movement, reason + note, STOCK_ADJUST before → after; going below 0 allowed, a count that changes nothing is refused), movement history (stock-after from a running total over all movements, so it stays right when filtered; cursor paging). DB integration tests.
  - [x] Web: Restock dialog (scan or type a name, repeat scan +1, unknown barcode → Add as new item and it joins the list, Now / Add / New, note, discard confirm), Adjust stock (Remove / Add / Set count, reason chips, result box, below-0 warning), Movement history (filters, grouped by day, Load older). Opened from the top Restock button, row Restock link, row menu and Edit item's "Restock · Adjust" links.
  - Reusable for checkout (step 6): `ProductSearchBox` (scan / search, unknown-barcode banner + beep), `ItemCard`, `StockBadge`.
- [x] **6. Checkout + cash**: cart store, checkout transaction, idempotency, bill numbers, audit log
  - [x] API: `POST /orders` in one transaction — bill number from the terminal's counter (failed sales don't use up numbers), today's prices snapshotted, totals and discount cap computed on the server, cash short refused, SALE movements (below 0 allowed), ORDER_CREATE + DISCOUNT_APPLIED. Same Idempotency-Key (even two at once) returns the same bill. `GET /terminals`. DB integration tests.
  - [x] Web: Checkout page with its own layout (scan box + category chips + product grid, "Current bill" panel, nav in a slide-in drawer from the right). Cart keeps only ids + quantities and is saved in local storage (survives reload / lost connection). Scan +1, typing anywhere lands in the scan box, unknown barcode banner + beep + Add as new item. − qty + with typing, Del removes the selected line, Clear bill (confirm). Discount popover (F4, chips 5/10/20/50, capped preview). Payment dialog: Cash; PromptPay / Credit cards shown but disabled until step 7.
  - Decisions made while building: an **empty "Amount received" means paid exactly** (F9 → Enter); the 1 / 2 / 3 method keys work when the cursor isn't in the amount field (digits type the amount there); a barcode scanned on the success screen starts the next sale with that item; the terminal is the first active one until Settings (step 10) lets an admin pick it per PC.
  - "View bill" on the success screen opens the bill (step 9).
- [x] **7. PromptPay + credit payment**: PromptPay as pending at checkout, PromptPay check page (mark received / undo), credit charge at checkout
  - [x] API: checkout takes `PROMPTPAY` (saved PENDING, no cash) and `CREDIT` (existing customer by id, or a new name — reused if the name matches ignoring case/spaces; CHARGE entry; CUSTOMER_CREATE + CREDIT_CHARGE with balance before → after; refused when the total is 0). `POST /orders` now returns `{ order, customerBalance }`. PromptPay board / summary / receive (bulk, one PROMPTPAY_RECEIVED per bill) / undo (reason, PROMPTPAY_RECEIVED_UNDO). Voided bills drop off the list. DB integration tests.
  - [x] Web: payment dialog has all three methods (Complete sale / Save as pending / Add to credit), customer autocomplete with what each person owes + "New customer", "will owe 22.00 → 207.00 ฿", success states for each method. PromptPay page: stat cards, Pending / Received today / All, grouped by day, "Same amount" tag (same amount within 30 min), select + bulk bar, Mark received, undo with reason. Amber pending count on the sidebar (refreshes every minute).
- [x] **8. Credit page**: balances, history, repayments
  - [x] API: `GET /credit` (every customer with balance + oldest unpaid date, stat cards), `GET /credit/customers/:id` (history newest first with running balance, first charge, credit bill count), add / edit customer (name unique ignoring case/spaces, optional phone + note, CUSTOMER_CREATE / CUSTOMER_UPDATE with only changed fields), `POST /credit/repayments` (customer row locked so two payments at once can't overpay; refused above what they owe; CREDIT_REPAYMENT with balance before → after). Oldest unpaid uses first-in-first-out (payments clear the oldest charges first; a voided charge cancels its own sale). DB integration tests.
  - [x] Web: Credit page (Total owed / Collected today cards, search name or phone, Owes money / All chips with counts, Highest first / Oldest debt sort, amber badge from 30 days, Record payment per row, whole row opens the customer). Customer dialog: owes-now box, history (Date · What · Amount · Balance, bill number under each sale), phone, edit pencil. Record payment: Full / 100 / 200 / 300 / 500 chips (only up to what they owe), Cash / PromptPay required, "will owe 200.00 → 150.00 ฿", optional note. Add customer switches to All and shows them.
- [x] **9. Orders + void**: history, filters, void transaction
  - [x] API: `GET /orders` (Bangkok date range up to 366 days, search bill no. or credit customer, All / Cash / PromptPay / Credit / Voided, newest first with cursor paging, per-method stats where voided bills never count as sales), `GET /orders/:id` (with who voided, when, reason, note), `POST /orders/:id/void` (order row locked so it voids once; VOID_RETURN movements, CHARGE_VOID + CREDIT_CHARGE_VOID with balance before → after, ORDER_VOID with reason; a pending PromptPay bill leaves the check page and can't be marked received). New column `Order.voidNote` (migration `order_void_note`). DB integration tests incl. two voids at once.
  - [x] Web: Orders page (search, date chip with Today / Yesterday / Last 7 days / This month / pick dates, payment chips with counts + separate Voided chip, summary strip, grouped by day, voided rows gray + struck through, Load older bills). Bill detail dialog (items, totals, payment box with Mark received for pending PromptPay and a link to the credit customer, voided info) and Void step (banner says exactly what happens to stock and money, reason chips, note required for Other). One bill viewer for the whole app: bill numbers in Orders, PromptPay page, movement history, credit history and "View bill" on the sale success screen open the bill on top of the current screen.
  - [x] Refactors: shared `noteSchema` / `optionalText` (fields.ts), `PAYMENT_METHOD_LABELS`, API cursor helper (lib/cursor.ts), test cleanup helpers (`deleteTerminalOrders`, `deleteTestCustomers`).
- [x] **10. Users + Settings (Admin)**: users list, add / edit / reset password / turn off, shop settings (report time is read by step 11)
  - [x] API: `/users` (list, add, edit, turn off / on, reset password), `PATCH /settings`, `POST /terminals`, all admin only. Admin routes re-check the role and "active" in the database, so a demoted or turned-off admin loses them at once (not after 15 minutes). Rules: you can't remove your own Admin role or turn yourself off; there is always one active admin (the active admins are row-locked, so two admins removing each other at once leave one). Turning off and resetting a password end every session. Audit: USER_CREATE, USER_UPDATE (changed fields; "passwordReset" without the password), ROLE_CHANGE, USER_DEACTIVATE, SETTINGS_UPDATE (only changed fields), TERMINAL_CREATE. `pnpm user:*` uses the same service. DB test files now run one at a time (they share one database). DB integration tests incl. both races.
  - [x] Web: Users page (avatar, "(you)", dark Admin / gray Cashier badge, Active / Turned off, last login, "…" menu: Edit, Reset password, Turn off / Turn on; your own Turn off is disabled and your own role is locked). Add / Edit user and Reset password dialogs (resetting your own password logs you out to log in again). Settings page (Shop, Daily report with 24-hour report time + Send to LINE switch, Terminals, Stock; unsaved-changes bar; asks before leaving with unsaved changes). Terminals: next bill number, "This PC" badge, "Use on this PC" (saved in the browser), "+ Add terminal". With one terminal every PC uses it; with several, checkout asks for this PC to be picked first.
  - [x] Every request now sends this PC's terminal (`x-terminal-id`), so all audit entries record the device, not only sales.
  - [ ] LINE status box ("Connected · group name" / "Not connected") and "Send test" come with step 11 (they need the LINE integration).
  - [x] Refactors: `Avatar` (Credit, Users, sidebar; Thai leading vowels handled), form error helpers `fieldErrorsFrom` / `apiFieldErrors` (all forms), shared `phoneSchema` and `ROLE_LABELS`, `HttpError.sessionEnded()`, terminals moved to their own feature (`features/terminals`).
- [ ] **11. Reports**: manual summary, saved daily snapshot, LINE push, scheduled trigger (decide Render sleep option)
- [ ] **12. Testing pass**: checkout, void, discount clamp, credit balance, report totals
- [ ] **13. Deploy**: Vercel (web), Render (API), Supabase (prod DB), env vars, CORS, smoke test

---

## 11. Must-pass tests

- Discount: 100 THB − 10 THB = 90 THB; discount larger than subtotal → total 0, never negative; negative input rejected
- Checkout: same idempotency key twice → one order only
- Checkout: stock and order always succeed or fail together
- Server recalculates totals; client-sent totals are ignored
- Void: stock returned, credit reversed, audit entry written
- Restock: all rows saved or none; qty ≤ 0 rejected; same product twice in one request is merged
- PromptPay: new bill is PENDING; marking received stores who/when; can't mark twice; undo requires a reason; pending bills not counted as money received
- Credit: balance correct after charges, partial repayments, and voids; repayment cannot exceed balance
- Credit: voiding a credit bill adds a CHARGE_VOID and is **not** counted as money received; repayments are split by method (cash / PromptPay) in reports
- Reports: Bangkok day boundaries correct; sales vs money received separated correctly
- Roles: cashier blocked from user management and settings; admin-only routes return 403 for cashier

---

## 12. Open items

### Decide before coding starts (after the design session)
- [x] **Products vs Stock: decided 2026-10-12 → one page, "Stock"** (Option A)
  - The Stock page is the product page too: list, search, Add new item, Restock; row "…" menu with Edit item, Adjust stock, Movement history, Deactivate.
  - Add a **Category filter** chip/dropdown on the Stock page so categories are visible and usable.
  - **Build rule so we can split later:** Add item, Edit item, Restock, Adjust stock and Movement history are standalone components (take a product id, load and save their own data via the API), not code inside the Stock page.
  - **Split into Products + Stock later** if the catalog grows into the hundreds and needs bulk price/category work. No database or API change needed then: new route + sidebar item, move columns/buttons.
- [x] **Receipt in Phase 1: decided 2026-10-12 → on screen only** (no printing in Phase 1)
  - The payment success screen is the receipt: bill no., method, total, change (cash), pending note (PromptPay), new balance (credit).
  - Bill detail (Orders page) shows the full bill any time after.
  - No "Print receipt" link on the success screen and no "Reprint" button in Bill detail in Phase 1.
  - Printable receipt page (58/80mm via the browser) and thermal printer (ESC/POS) support move to Phase 2.

### Design still to do (can run alongside the first build steps)
- [x] Orders page + bill detail + void dialog (approved, specced in section 9)
- [x] Credit page + customer dialog + record payment (approved, specced in section 9)
- [x] Reports page: Summary + Daily reports tabs + LINE message format (approved, specced in section 9)
- [x] Payment dialog: success screen (approved) and "Short by" cash error (specced)
- [x] Users and Settings pages (approved, specced in section 9)
- [x] States and feedback: discount input, unknown barcode, empty states, loading, no internet, toasts, confirm dialogs, session expired, no permission (approved, specced in section 9)
- [ ] Restock modal as real Figma layers (currently a pasted image)
- [ ] Small fixes: cart Subtotal → Discount → Total order; login labels above fields
- [ ] Build Adjust stock and Movement history in Figma (optional now: both are built in code in step 5, which is the source of truth)

### Needed later (by build step 11)
- [ ] Choose how the auto report is triggered (paid Render / Render Cron Job / Supabase pg_cron)
- [ ] Report time (closing time) for the auto report: editable on the Settings page since step 10 (`ShopSetting.reportTime`); the scheduler must read it
- [ ] Print the shop PromptPay QR for the counter
- [ ] Create LINE Official Account + Messaging API channel, add bot to shop group

---

## Later phases (for reference)

- **Next, right after Phase 1 is finished: Audit log screen** (decided 2026-10-12, first thing we build after Phase 1)
  - "Activity" page for Admin only, added to the sidebar's Admin section.
  - Filters: date range, user, action type, and search by bill no. / product / customer.
  - Table: time, user (name + role), action, what it affected, short summary; row opens a detail view with before → after, reason and note.
  - "View history" link from a bill (Bill detail), a product (Movement history / Edit item) and a customer (Credit dialog) that opens the Activity page pre-filtered to that item.
  - Read-only, CSV export. No new tables needed: the data is already being recorded from day one in Phase 1.
- **Phase 2**: Percent discounts, split payments, receipt printing (printable 58/80mm receipt page + Reprint in Bill detail, then ESC/POS thermal printer), dynamic QR with amount (optional)
- **Phase 3**: Offline-first (local SQLite, outbox + sync worker, audit hash chain, per-device sequences)
- **Later**: Loyalty, multi-branch, promotions, card payments, tax invoices
