# Deploying MarketHub to Vercel

This guide takes the repo from a fresh clone to a working deployment. It also
explains the one failure mode that catches almost everyone, because it is what
the first deploy of this project hit.

---

## The failure you probably saw

If the deployed site showed **raw TypeScript source code** in the browser —
`var __defProp = Object.defineProperty;`, `// server/_core/index.ts`,
`// drizzle/schema.ts` — then Vercel served the **API server bundle as the web
page**.

**Why it happened.** This app has two build outputs:

| Output | Path | What it is |
|---|---|---|
| Client (SPA) | `dist/public/` | `index.html` + hashed assets — the website |
| Server (API) | `dist/index.js` | the bundled Hono/tRPC server |

Vercel's Vite preset assumes a single output at `dist/`. It found no
`index.html` at the root of `dist/`, so its static handler fell through to the
only file it could find — `dist/index.js` — and served it as a document. The
browser then rendered the bundle as text.

**The fix** (already committed) is three files:

- **`vercel.json`** — pins `buildCommand` to `pnpm build:web` and
  `outputDirectory` to `dist/public`, so Vercel serves the SPA and nothing else.
- **`api/index.ts`** — a serverless function that runs the whole API, so
  `/trpc` has something to answer it.
- **`server/app.ts`** — the shared route table, used by both the Node server and
  the serverless function, so the two cannot drift apart.

---

## 1. Prerequisites

- A **PostgreSQL** database reachable from the public internet. Any of these
  work: [Neon](https://neon.tech) (free tier, recommended), Supabase, Railway,
  RDS, or your own server.
- A Vercel account with this repo connected.

> **Use the direct (non-pooler) connection string** for migrations. Neon's
> pooler endpoint (the one with `-pooler` in the hostname) does not support the
> session-level operations `drizzle-kit migrate` needs.

---

## 2. Environment variables

Set these in **Vercel → your project → Settings → Environment Variables**.
Apply them to **Production, Preview and Development** unless you have a reason
not to.

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | **Yes** | Full Postgres connection string, e.g. `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | **Yes** | A long random string. Generate with `openssl rand -base64 48` |
| `DB_DRIVER` | No | `tcp` (default) or `http`. See the note below. |
| `DB_POOL_MAX` | No | Max pool connections, default `5`. Ignored when `DB_DRIVER=http`. |
| `ADMIN_EMAILS` | No | Comma-separated emails auto-promoted to admin on signup, e.g. `you@example.com` |
| `APP_SLUG` | No | Cookie-name namespace. Defaults to `app`. |
| `APP_STORAGE_PRESIGN_URL` | No | Only for product-image uploads (see §6) |
| `APP_STORAGE_TOKEN` | No | Only for product-image uploads (see §6) |

**`DB_DRIVER` — which one?**

- **`tcp`** (default) — `node-postgres` pool. Works with any Postgres. Correct
  for a long-lived Node host (Docker, Railway, Fly, a VPS).
- **`http`** — Neon's serverless HTTP driver. One request per query, no TCP
  pool. This is the better fit for **Vercel serverless functions**, which are
  short-lived and can exhaust a TCP pool under load. It requires a **Neon**
  database (the driver speaks Neon's HTTP protocol, not generic Postgres).

If you are deploying to Vercel **with Neon**, set `DB_DRIVER=http`. If you are
deploying to Vercel with any other Postgres, leave it as `tcp` — it works, it
just opens a small pool per function instance.

> **Do not** put any of these in a `.env` file that gets committed. `.env` is
> gitignored; only `.env.example` (placeholders) is tracked.

---

## 3. Run the migrations

The schema must exist before the app can serve anything. Run this **once** from
your machine, against the same `DATABASE_URL` you gave Vercel:

```bash
git clone https://github.com/natlusniel-code/markethub.git
cd markethub
pnpm install

export DATABASE_URL="postgresql://..."   # the direct, non-pooler URL
pnpm db:migrate                          # creates all tables
pnpm db:seed                             # 9 categories + 27 products
```

`pnpm db:seed` is idempotent — it is safe to re-run.

---

## 4. Deploy

```bash
git push origin main
```

Vercel builds on push. The build runs `pnpm install --frozen-lockfile` then
`pnpm build:web`, and publishes `dist/public`.

**Verify the deploy worked** — open these two URLs on your deployment:

| URL | Expected |
|---|---|
| `/api/health` | `{"ok":true}` |
| `/` | the MarketHub storefront |

If `/api/health` returns a **503** with `server_not_configured`, the function
started but `DATABASE_URL` or `JWT_SECRET` is missing — the response names the
exact variable. Add it and redeploy.

If `/` shows raw source code, `vercel.json` is not being picked up. Confirm it
is committed at the **repo root** (not inside a subdirectory) and that
**Settings → Build & Development → Output Directory** is not overriding it.

---

## 5. Create the first administrator

There is no way to self-grant admin — that is deliberate. Pick one:

**Option A — environment variable (recommended).** Set `ADMIN_EMAILS` to your
email in Vercel, redeploy, then sign up with that address. The account is
created with `role = 'admin'`.

**Option B — CLI.** After signing up normally:

```bash
export DATABASE_URL="postgresql://..."
pnpm admin:grant you@example.com
```

Then sign out and back in. The admin dashboard is at **`/admin`** — it is not
linked from the public site, by design.

---

## 6. Product image uploads (optional)

Product images are served from `client/public/products/` by default, so the
store works without any storage configuration. To let admins **upload** new
images from the dashboard, you need the platform storage credentials:

- `APP_STORAGE_PRESIGN_URL` — the presign endpoint
- `APP_STORAGE_TOKEN` — the scoped storage token

Without them, the upload control reports that storage is not configured and the
rest of the admin dashboard is unaffected. This is a platform-specific
integration; on a self-hosted deployment you would swap `server/_core/storage.ts`
for S3, Cloudinary or similar.

---

## 7. What still needs your input

| Item | Status |
|---|---|
| `DATABASE_URL`, `JWT_SECRET` | **You must set these** — the app cannot start without them |
| Migrations + seed | **You must run these once** (§3) |
| First admin | **You must do this** (§5) |
| Bank details | Set in **Admin → Payment settings** after logging in. Until then the payment page shows an honest "not configured" notice rather than fake account numbers. |
| Product images | Seeded placeholders work; replace via **Admin → Products** |
| Storage credentials | Optional, only for in-dashboard uploads (§6) |

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Raw TypeScript in the browser | Vercel served `dist/index.js` as the page | `vercel.json` missing or not at repo root |
| `/api/health` → 503 `server_not_configured` | `DATABASE_URL` or `JWT_SECRET` unset | Add it in Settings → Environment Variables, redeploy |
| `/api/health` → 500, logs show `ECONNREFUSED` | Database unreachable from Vercel | Check the host allows external connections and `sslmode=require` is set |
| Storefront loads, products empty | Migrations or seed not run | Run §3 |
| `No transactions support in neon-http driver` | Code used `db.transaction` with `DB_DRIVER=http` | Use `atomic()` from `server/_core/db.ts` instead |
| Login succeeds but session does not persist | `JWT_SECRET` changed between deploys | Set it once and leave it; changing it invalidates every session |
| 404 on a deep link like `/orders` | SPA rewrite missing | Confirm the `/(.*)` → `/index.html` rewrite in `vercel.json` |

---

## 9. Deploying somewhere other than Vercel

The app is a standard Node service and is not Vercel-specific. The `Dockerfile`
builds and runs it as a single process:

```bash
docker build -t markethub .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  markethub
```

In that mode `server/_core/index.ts` serves **both** the API and the built SPA
from one process, and `vercel.json` / `api/` are simply unused. This is the
right shape for Railway, Fly.io, Render, Cloud Run or a VPS.
