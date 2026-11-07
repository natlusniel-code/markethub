import "dotenv/config"; // load .env into process.env before env.ts reads it.
// No-op when .env is absent (platform injects real env) and never overrides
// already-set vars — so it's safe in prod. MUST stay the first import.
import { serve } from "@hono/node-server";
import { createApp } from "../app";
import { mountClient } from "./serve";
import { env } from "./env";

// Long-lived Node process: the shared API surface (server/app.ts) PLUS the
// static SPA mount. This is what `pnpm dev:api`, `pnpm start` and the Docker
// image run.
//
// The Vercel deployment does NOT use this file — it uses api/index.ts, which
// mounts the same createApp() without the static mount, because Vercel's CDN
// serves the built client itself. Routes live in server/app.ts so the two
// runtimes cannot drift apart.
const app = createApp();

// Client: prod serves built SPA here; dev is served by Vite (which proxies API).
mountClient(app);

const port = env.isProd ? env.port : env.apiPort;
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[server] listening on :${port} (${env.isProd ? "prod" : "dev-api"})`);
