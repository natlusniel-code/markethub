# Production starter catalogue setup

MarketHub includes an idempotent seed for **200 starter products** across the ten
store categories. The product records and their image files are in the existing
repository; seeding writes the product and category rows to PostgreSQL.

## Run against the production database

1. Configure the production `DATABASE_URL` in the deployment and locally in a
   temporary, uncommitted environment (or export it in your shell). Use a
   database connection that permits migrations and writes.
2. Apply the schema migrations:

   ```bash
   pnpm install --frozen-lockfile
   pnpm db:migrate
   ```

3. Seed and verify the catalogue:

   ```bash
   node scripts/seed.mjs
   ```

   The script checks that all referenced local product images exist before
   writing and prints a final `200/200` product and image-record check. Re-running
   it is safe: existing product edits are not overwritten and rows are not
   duplicated. The check counts the 200 starter slugs, so additional products
   later created by administrators do not make the starter seed fail.

The Vercel build does **not** run database migrations or seed production data.
Run the steps above against the same production database configured for Vercel;
then check the storefront and `/api/health`. Do not report the catalogue as
present until the seed command has completed successfully against that database.

## Configure both administrators

Set `ADMIN_EMAILS` in the production environment to the two authorized email
addresses, comma-separated. Do not commit the real addresses or secrets to this
repository. Users registering with those allowlisted addresses are granted admin
role server-side; ordinary customer registrations cannot set their own role.
After configuration, deploy/restart and sign in with each authorized account to
confirm `/admin` access. The repository does not contain the owners' email
addresses, so they must be supplied in the deployment environment.
