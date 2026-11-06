#!/usr/bin/env node
/**
 * Apply drizzle/seed.sql to the database in DATABASE_URL.
 *
 *   node scripts/seed.mjs
 *
 * The SQL is idempotent (ON CONFLICT DO NOTHING), so running it twice is safe.
 * It is deliberately NOT a drizzle migration: the catalogue is sample content a
 * real shop replaces, whereas migrations are schema. Run it once after
 * `pnpm db:migrate` on a fresh database.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "drizzle", "seed.sql"), "utf8");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const { rows } = await client.query(`
    select
      (select count(*) from categories)::int as categories,
      (select count(*) from products)::int as products,
      (select count(*) from product_images)::int as images,
      (select count(*) from product_variants)::int as variants,
      (select count(*) from payment_settings)::int as payment_settings
  `);
  console.log("Seed applied:", rows[0]);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
