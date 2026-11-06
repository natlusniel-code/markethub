# MarketHub

A complete, working e-commerce application: a public customer storefront and a
private staff dashboard on one domain, backed by a real PostgreSQL database,
with **manual bank-transfer payments and human verification** — no payment
gateway, no auto-marking anything as paid.

Built as a real application, not a prototype: every button is wired to a real
API procedure, every number on the dashboard is computed from database rows, and
all state survives a refresh.

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuring the first administrator](#configuring-the-first-administrator)
- [How the payment flow works](#how-the-payment-flow-works)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Security model](#security-model)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [What still needs external configuration](#what-still-needs-external-configuration)

---

## What it does

### Customer storefront

- **Homepage** — hero, promo banners, flash deals, featured, best sellers, new
  arrivals, category grid, trending, recommended, discounted collections and a
  newsletter block. Every section is a database query, not hardcoded markup.
- **Browse & search** — full-text product search with live suggestions, category
  pages, price-range / discount / availability filters, and sorting by price,
  popularity or newest. Paginated.
- **Product pages** — multiple images, description, original and discounted
  price, computed discount %, size/colour variants, live stock, ratings and
  reviews, related products, Add to Cart, Buy Now, Add to Wishlist.
- **Cart** — persistent per account, quantity and variant editing, live stock
  caps, server-computed subtotal, delivery charge and total.
- **Wishlist** — save and revisit products.
- **Checkout** — saved address selection or a new address, order notes, and
  totals recomputed **server-side** (the client never sends a price).
- **Payment instructions** — unique order number, amount, and bank details read
  from the `payment_settings` table (never hardcoded), plus a reference
  submission form.
- **Orders** — history and per-order detail with items, totals, payment status,
  order status and a progress tracker.
- **Account** — profile editing, saved addresses, password change.
- **Notifications** — in-app bell with unread count, read state and history.

### Admin dashboard (`/admin`)

- **Overview** — revenue from verified payments, total orders, pending and
  verified payments, customers, products, low-stock alerts, average order value,
  a 14-day sales chart, recent orders and recent activity. All from real rows.
- **Products** — create, edit, delete; multiple images; price and discount price;
  stock; variants; category; featured flag; search and category filter.
- **Orders** — search, status filters, customer and payment detail, manual status
  updates through the full delivery lifecycle, and cancellation (which restocks).
- **Payments** — pending / verified / rejected queues, approve or reject with an
  internal note, linked order and customer.
- **Payment settings** — bank name, account name, account number and
  instructions, stored in the database and reflected on the customer page
  immediately.
- **Customers** — search, detail, order history, grant/revoke admin, suspend.

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript, Vite, Tailwind CSS, shadcn-style primitives |
| Routing | wouter (client-side SPA) |
| API | tRPC v11 over a single typed router |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Auth | Email + password, scrypt hashing, signed HttpOnly session cookie |
| Validation | Zod schemas on every input |
| Tests | Vitest (139 tests) |

Money is stored as **integer kobo** (₦1 = 100 kobo) everywhere. No floating
point touches a price.

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env
#    then set DATABASE_URL and JWT_SECRET

# 3. Create the schema
pnpm db:migrate

# 4. Load the catalogue (9 categories, 27 products, variants)
pnpm db:seed

# 5. Run
pnpm dev
```

The storefront is at `http://localhost:3000`, the dashboard at
`http://localhost:3000/admin`.

### Using Supabase as the database

Supabase is just PostgreSQL, so it works unchanged:

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI**. Copy the
   **pooled** (port `6543`) string.
3. Put it in `DATABASE_URL`, keeping `?sslmode=require`.
4. Run `pnpm db:migrate && pnpm db:seed`.

The schema is plain PostgreSQL — no Supabase-specific extensions are required,
so the same migrations run on Neon, RDS or a local container.

---

## Configuring the first administrator

There are two supported paths, both server-side. **A customer can never promote
themselves** — the `role` column is only ever written by one of these two paths
or by an existing admin through the dashboard.

**Option A — environment variable (zero-touch).** Set:

```bash
ADMIN_EMAILS=you@example.com
```

Any account with that email is promoted at signup and re-checked at every login.
Restart the server after changing it.

**Option B — CLI promotion.** Sign up normally in the app, then:

```bash
pnpm admin:grant you@example.com
```

This runs with database credentials on the server, so it is unreachable over
HTTP. Use it when you would rather not keep an email in the environment.

Once one admin exists, further admins are granted from
**Admin → Customers → Manage → Grant admin**.

---

## How the payment flow works

This is the part most e-commerce demos fake. Here is the real sequence:

1. Customer checks out. The server recomputes every line total from the
   database, decrements stock inside a transaction, creates the order with
   status `pending_payment`, and returns a unique order number
   (`MH-YYYYMMDD-XXXX`).
2. The customer lands on the payment instructions page, which reads the bank
   details from `payment_settings`.
3. They pay by bank transfer, then submit the reference/transaction ID. This
   writes a `payments` row with status **`awaiting_verification`**, sets the
   order to `payment_verification`, and notifies every admin.
   **Nothing is marked paid here.**
4. An admin opens **Admin → Payments**, sees the reference next to the expected
   amount and the customer, and approves or rejects it with an internal note.
5. **Approve** → payment `verified`, order `paid`, customer notified.
   **Reject** → payment `rejected`, order back to `pending_payment`, customer
   notified and able to submit a corrected reference.
6. A second approval of the same payment is refused, so a double-click cannot
   double-count revenue.

Revenue on the dashboard counts **only** verified payments.

---

## Project structure

```
app/
├── client/
│   ├── public/                 favicon set, product images, manifest
│   └── src/
│       ├── components/
│       │   ├── admin/          AdminLayout, admin-only widgets
│       │   ├── brand/          Logo + LogoMark (shared with the favicon script)
│       │   ├── store/          StoreHeader, StoreFooter, ProductCard, …
│       │   └── ui/             button, input, select, badge, toast, states
│       ├── pages/
│       │   ├── admin/          AdminOverview, AdminProducts, AdminOrders,
│       │   │                   AdminPayments, AdminUsers, AdminSettings
│       │   └── *.tsx           storefront pages
│       ├── lib/format.ts       money, dates, status vocabulary
│       └── App.tsx             route table
├── drizzle/
│   ├── schema.ts               the 17-table schema
│   ├── migrations/             generated SQL migrations
│   └── seed.sql                categories, products, variants
├── scripts/
│   ├── make-icons.py           regenerates the favicon set from the logo geometry
│   ├── seed.mjs                applies seed.sql
│   └── grant-admin.mjs         CLI admin promotion
├── server/
│   ├── db.ts                   all business queries
│   ├── routers.ts              the tRPC API surface
│   ├── services/rate-limit.ts  fixed-window limiter
│   └── _core/                  platform primitives (auth, db, trpc, storage)
└── shared/                     types and constants shared by both sides
```

---

## Data model

17 tables, all with foreign keys and indexes on the columns that are filtered.

| Table | Purpose |
|---|---|
| `users` | Accounts, `role` (`customer` / `admin`), `status` (`active` / `suspended`) |
| `categories` | The nine departments, with slug and sort order |
| `products` | Name, slug, description, price, discount price, stock, featured, status |
| `product_images` | Ordered images per product |
| `product_variants` | Size / colour options with their own stock and price delta |
| `carts` / `cart_items` | One cart per user; lines reference product + variant |
| `addresses` | Saved delivery addresses, one default per user |
| `orders` | Order number, status, payment status, address snapshot, totals |
| `order_items` | Immutable line snapshots (name, price, quantity at purchase time) |
| `payments` | Reference, status, admin note, reviewer, timestamps |
| `payment_settings` | Single row: bank name, account name, account number, instructions |
| `reviews` | Rating + body, one per user per product |
| `wishlists` | Saved products per user |
| `notifications` | Per-user, with audience (`customer` / `admin`) and read state |

Order totals are **snapshotted** onto the order, so a later price change never
rewrites history.

---

## Security model

- **Role is server-owned.** `role` is written only by the `ADMIN_EMAILS` sync, the
  `admin:grant` CLI, or an existing admin's `admin.setRole` call. There is no
  customer-reachable path to it.
- **Every admin procedure** goes through an `adminProcedure` middleware that
  re-reads the role from the database on each request — a stale cookie cannot
  carry admin rights.
- **Every user-scoped query** filters by `ctx.user.id`. Requesting another
  customer's order returns "not found", not their data.
- **Prices are never trusted from the client.** Checkout recomputes from the
  database.
- **Rate limiting** on login, signup and payment-reference submission.
- **Sessions** are signed HttpOnly cookies; the secret lives only in the
  environment.
- **No secrets in client code** — the browser bundle contains no database URL,
  no session secret, no server key.

---

## Deployment

The app is a standard Node service plus a static client build, so it deploys to
any Node host (Vercel, Railway, Fly, Render, a VPS).

### Vercel

1. Push the repository to GitHub (see `PUSH-TO-GITHUB.md`).
2. In Vercel, **Add New → Project** and import the repo.
3. Set the environment variables from `.env.example`:
   `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAILS`, `APP_URL`.
4. Build command `pnpm build`, output as configured in `vercel.json`.
5. Deploy, then run the migrations once against the production database:
   `DATABASE_URL="<prod url>" pnpm db:migrate && pnpm db:seed`.
6. Sign up with the email in `ADMIN_EMAILS` and open `/admin`.

### Any Node host

```bash
pnpm install
pnpm build
pnpm db:migrate
NODE_ENV=production pnpm start
```

Put it behind HTTPS — the session cookie is `Secure` in production.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | API + client with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:seed` | Load categories, products and variants |
| `pnpm admin:grant <email>` | Promote an existing account to admin |
| `pnpm test` | Run the test suite |
| `pnpm typecheck` | TypeScript, no emit |
| `python3 scripts/make-icons.py` | Regenerate the favicon set |

---

## What still needs external configuration

Everything in the application is implemented and working. These items need
credentials or a decision that belongs to you:

| Item | What you need to do |
|---|---|
| **PostgreSQL** | Provide a `DATABASE_URL`. Supabase, Neon, RDS or local all work. |
| **`JWT_SECRET`** | Generate one strong random value per environment. |
| **First admin** | Set `ADMIN_EMAILS`, or run `pnpm admin:grant`. |
| **Bank details** | Fill in **Admin → Payment settings** with your real bank name, account name, account number and instructions. Until you do, the payment page shows a clear "not configured yet" notice rather than fake details. |
| **Product photography** | The 27 seeded products ship with generated placeholder photography. Replace them with your own via **Admin → Products**. |
| **Domain** | Point your domain at the deployment and set `APP_URL`. |
| **Google OAuth** | **Not implemented.** The agreed stack uses email + password accounts. Adding Google would mean adding an OAuth client and a callback route. |
| **Cloudinary** | **Not used.** Product images are stored through the platform's upload service. Swapping in Cloudinary means changing the upload call in the product form. |
| **Automated payments** | **Deliberately absent.** This build is manual bank transfer with human verification, as specified. |
| **Outbound email** | **Not implemented.** All notifications are in-app, as specified. |

---

## Licence

Provided as-is for the project it was built for.
