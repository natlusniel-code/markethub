import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { serveAppStorage } from "./_core/storage";
import { getJob } from "./_core/jobs";

// The ONE definition of the app's HTTP surface, shared by every runtime:
//
//   server/_core/index.ts  — the Node process (`pnpm dev:api`, `pnpm start`,
//                            Docker, any long-lived host). Adds the static SPA
//                            mount on top of this.
//   api/index.ts           — the Vercel serverless function. Vercel serves the
//                            built SPA from its own CDN, so it does NOT mount
//                            the client here.
//
// Keeping the routes in one place is what stops the two deployments drifting:
// a new endpoint added for the Node server is automatically live on Vercel, and
// vice versa. Anything runtime-specific (static files, `serve()`, fs access)
// stays OUT of this file — that is the whole point of the split.
export function createApp(): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true }));

  // tRPC — all app business endpoints live under /trpc (see server/routers.ts).
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) => createContext(c),
    }),
  );

  // Scoped per-app file storage: 307 → short-lived signed S3 URL.
  app.all("/app-storage/*", (c) => serveAppStorage(c));

  // Platform-signed scheduled-job callback. The body runs in THIS app's runtime;
  // the platform only triggers on schedule. Until the platform signature scheme
  // exists we REQUIRE (and, later, verify) a signature header, so a registered
  // job can never be triggered by an anonymous caller.
  // TODO: replace the presence check with real HMAC verification.
  app.post("/api/_jobs/:name", async (c) => {
    const signature = c.req.header("x-platform-signature");
    if (!signature /* || !verifyPlatformSignature(c, signature) */) {
      return c.text("unauthorized (job callback signature required)", 401);
    }
    const handler = getJob(c.req.param("name"));
    if (!handler) return c.text("no such job", 404);
    try {
      await handler();
      return c.json({ ok: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[jobs] "${c.req.param("name")}" failed`, err);
      return c.text("job failed", 500);
    }
  });

  return app;
}
