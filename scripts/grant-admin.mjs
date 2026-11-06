#!/usr/bin/env node
/**
 * Promote an existing account to administrator.
 *
 *   pnpm admin:grant admin@example.com
 *
 * This is the "protected database setup process" for the FIRST administrator:
 * it runs server-side with database credentials, so no customer can ever reach
 * it over HTTP. After the first admin exists, further admins are granted from
 * the dashboard (Customers → Manage → Grant admin), which is itself
 * admin-authorised.
 *
 * The alternative, zero-touch path is the ADMIN_EMAILS environment variable:
 * any account whose email is listed there is promoted automatically at signup
 * and at every login (see syncAdminRole in server/db.ts).
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/_core/db.ts";
import { users } from "../drizzle/schema.ts";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: pnpm admin:grant <email>");
  process.exit(1);
}

const [user] = await db.select().from(users).where(eq(users.email, email));

if (!user) {
  console.error(`No account found for ${email}. Sign up in the app first, then run this again.`);
  process.exit(1);
}

await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
console.log(`✓ ${email} is now an administrator.`);
process.exit(0);
