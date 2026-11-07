import pg from "pg";
import "dotenv/config";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const idx = await c.query(
  "select indexname, indexdef from pg_indexes where tablename='products' order by indexname",
);
console.log("products indexes:");
for (const r of idx.rows) console.log("  ", r.indexdef);

const ids = await c.query("select id, slug from products order by id");
console.log("\nlegacy ids:");
for (const r of ids.rows) console.log("  ", r.id, r.slug);

const legacyCount = await c.query(
  "select count(*)::int n from products where id::text like 'a0000000-0000-4000-8000-%'",
);
console.log("\nrows matching legacy id prefix:", legacyCount.rows[0].n);

await c.end();
