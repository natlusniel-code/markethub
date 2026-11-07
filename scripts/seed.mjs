#!/usr/bin/env node
/**
 * Seed the MarketHub starter catalogue: exactly 200 products.
 *
 *   node scripts/seed.mjs
 *
 * IDEMPOTENT BY CONSTRUCTION. Every row is keyed by a deterministic id derived
 * from the product slug (see scripts/seed-data.mjs → stableId), and every insert
 * is `ON CONFLICT DO NOTHING`. Running this twice inserts nothing the second
 * time. It also never UPDATES an existing product, so a redeploy cannot silently
 * undo a price or description an admin has since edited in the dashboard.
 *
 * WHY NOT drizzle/seed.sql: that file is applied by `pnpm db:seed` on a fresh
 * database and holds the original 27-product sample. This script is the
 * 200-product starter catalogue and is safe to run against a live database.
 * Both can coexist; this one is additive.
 *
 * IMAGE CHECK: every referenced file is verified to exist in
 * client/public/products BEFORE anything is written. A product pointing at a
 * missing image renders as a broken card, which is worse than not seeding it, so
 * a missing file aborts the whole run rather than warning.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
// Loads .env when present (local runs); a no-op in production, where the
// platform injects DATABASE_URL into the environment directly.
import "dotenv/config";
import { buildProducts, CATEGORIES, stableId } from "./seed-data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "client", "public", "products");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const products = buildProducts();

// ── pre-flight: every image must exist on disk ───────────────────────────────
const missing = [...new Set(products.map((p) => p.image))].filter(
  (f) => !existsSync(join(publicDir, f)),
);
if (missing.length > 0) {
  console.error(`Refusing to seed — ${missing.length} image file(s) missing from client/public/products:`);
  for (const f of missing) console.error(`  - ${f}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");

  // ── retire the original 27-product sample ──────────────────────────────────
  // drizzle/seed.sql shipped 27 demo products with invented brand names
  // ("Aurora Pro", "Nova X9 5G", "AeroBook 14 Ultrabook"). Those are exactly the
  // kind of fabricated brand claim the brief rules out, and leaving them in
  // would also make the catalogue 227 rather than the required 200.
  //
  // They are identified by their id prefix, which is unique to that file — no
  // product this script creates can match it. Deleting them is safe for the one
  // existing order: order_items.product_id is ON DELETE SET NULL, so the order
  // keeps its name/price snapshot and simply loses the link to a product that no
  // longer exists. Nothing else references these rows except tables that cascade.
  const retired = await client.query(
    `DELETE FROM products WHERE id::text LIKE 'a0000000-0000-4000-8000-%' RETURNING slug`,
  );
  if (retired.rowCount > 0) {
    console.log(`Retired ${retired.rowCount} legacy sample product(s).`);
  }

  // ── categories ─────────────────────────────────────────────────────────────
  // Insert any that are missing. `ON CONFLICT (slug) DO NOTHING` leaves the
  // existing nine exactly as they are, including their ids — products reference
  // those ids, so rewriting them would orphan the catalogue.
  for (const c of CATEGORIES) {
    await client.query(
      `INSERT INTO categories (id, name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO NOTHING`,
      [stableId(`category:${c.slug}`), c.name, c.slug, c.description, c.sortOrder],
    );
  }

  const { rows: catRows } = await client.query("SELECT id, slug FROM categories");
  const catId = new Map(catRows.map((r) => [r.slug, r.id]));

  // ── products + images ──────────────────────────────────────────────────────
  let inserted = 0;
  for (const p of products) {
    const categoryId = catId.get(p.category);
    if (!categoryId) throw new Error(`No category row for slug "${p.category}"`);

    const id = stableId(p.slug);
    const res = await client.query(
      `INSERT INTO products
         (id, name, slug, description, subcategory, category_id, price, discount_price,
          stock, is_featured, status, rating_avg, rating_count, sold_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',0,0,0)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        p.name,
        p.slug,
        p.description,
        p.subcategory,
        categoryId,
        p.price,
        p.discountPrice,
        p.stock,
        p.featured,
      ],
    );
    inserted += res.rowCount;

    // The image row is keyed by (product_id, url) — the unique index added in
    // this change — so a re-run cannot duplicate it either.
    await client.query(
      `INSERT INTO product_images (id, product_id, url, sort_order)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (product_id, url) DO NOTHING`,
      [stableId(`${p.slug}:image`), id, `/products/${p.image}`],
    );
  }

  await client.query("COMMIT");

  const { rows } = await client.query(`
    SELECT
      (SELECT count(*) FROM categories)::int      AS categories,
      (SELECT count(*) FROM products)::int        AS products,
      (SELECT count(*) FROM product_images)::int  AS images,
      (SELECT count(*) FROM products WHERE status = 'active')::int AS active,
      (SELECT count(*) FROM products WHERE is_featured)::int       AS featured,
      (SELECT count(*) FROM products WHERE discount_price IS NOT NULL)::int AS discounted
  `);
  const s = rows[0];
  console.log(`Seed complete — ${inserted} new product(s) inserted this run.`);
  console.log(
    `Totals: ${s.products} products (${s.active} active, ${s.featured} featured, ${s.discounted} discounted), ` +
      `${s.images} images, ${s.categories} categories.`,
  );
  if (s.products !== 200) {
    console.error(`WARNING: expected exactly 200 products, found ${s.products}.`);
    process.exitCode = 1;
  }
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
