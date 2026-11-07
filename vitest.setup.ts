// Vitest setup: load .env before any test module is imported.
//
// WHY THIS IS NEEDED: `_core/env.ts` calls required("DATABASE_URL") and
// required("JWT_SECRET") at MODULE LOAD, and `_core/test-caller.ts` imports the
// real router — which reaches `_core/db` and therefore `_core/env`. Without this
// file, `pnpm test` fails at import time with "Missing required env var:
// DATABASE_URL" on suites that never touch a database, which reads as a broken
// test suite rather than a missing .env.
//
// The pool is lazy, so a DATABASE_URL that points at a database the tests never
// query is fine — nothing connects until a query is actually issued.
import "dotenv/config";
