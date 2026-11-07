// Vercel serverless entry point — the whole API as ONE function.
//
// WHY THIS FILE EXISTS: without it, a Vercel deploy of this repo has no server
// to answer /trpc, and — because the client build lands in dist/public while the
// server bundle lands in dist/index.js — Vercel's static output detection finds
// no index.html at the root and serves the *server bundle* as the page. That is
// the "raw TypeScript source in the browser" failure this file fixes.
//
// Two things make this robust rather than hopeful:
//
//  1. LAZY IMPORT. `server/_core/env.ts` throws at module load when DATABASE_URL
//     or JWT_SECRET is missing. A static import would turn a missing env var
//     into an opaque function crash (blank 500). Importing inside the handler
//     lets us catch it and return a readable JSON error naming the variable.
//
//  2. PATH RESTORATION. Vercel rewrites (vercel.json) forward /trpc/* and
//     /app-storage/* here with the original path in `__path`. Whether or not a
//     given Vercel runtime preserves the original path, the handler rebuilds it
//     from that parameter — so Hono always sees the path it routed on.
import type { Hono } from "hono";

type WebHandler = (req: Request) => Response | Promise<Response>;

let handlerPromise: Promise<WebHandler> | null = null;

function getHandler(): Promise<WebHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const [{ handle }, { createApp }] = await Promise.all([
        import("hono/vercel"),
        import("../server/app"),
      ]);
      return handle(createApp() as Hono);
    })();
  }
  return handlerPromise;
}

/** Rebuild the original request path from the `__path` rewrite parameter. */
function restorePath(req: Request): Request {
  const url = new URL(req.url);
  const original = url.searchParams.get("__path");
  if (!original) return req;

  url.searchParams.delete("__path");
  const qs = url.searchParams.toString();
  const target = new URL(original + (qs ? `?${qs}` : ""), url.origin);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(target, {
    method,
    headers: req.headers,
    body: hasBody ? req.body : undefined,
    // Required by undici when streaming a body; ignored elsewhere.
    duplex: "half",
  } as RequestInit);
}

/** Accept either a Web `Request` or a Node `IncomingMessage`. */
async function toWebRequest(req: unknown): Promise<Request> {
  if (typeof Request !== "undefined" && req instanceof Request) return req;

  const nodeReq = req as {
    url?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
  };

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers ?? {})) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.set(key, String(value));
  }

  const proto = headers.get("x-forwarded-proto") ?? "https";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const url = new URL(nodeReq.url ?? "/", `${proto}://${host}`);
  const method = (nodeReq.method ?? "GET").toUpperCase();

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD" && nodeReq[Symbol.asyncIterator]) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of nodeReq as AsyncIterable<Uint8Array>) {
      chunks.push(new Uint8Array(chunk));
    }
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    body = merged;
  }

  return new Request(url, { method, headers, body });
}

function configError(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error("[api] failed to initialise", err);
  return new Response(
    JSON.stringify({
      error: "server_not_configured",
      message,
      hint:
        "Set DATABASE_URL and JWT_SECRET in Vercel → Project → Settings → " +
        "Environment Variables, then redeploy. See VERCEL-DEPLOY.md.",
    }),
    { status: 503, headers: { "content-type": "application/json" } },
  );
}

export default async function handler(req: unknown, res?: unknown): Promise<unknown> {
  let response: Response;
  try {
    const webHandler = await getHandler();
    response = await webHandler(restorePath(await toWebRequest(req)));
  } catch (err) {
    response = configError(err);
  }

  // Node-style (req, res) invocation: write the response out ourselves.
  const nodeRes = res as
    | {
        statusCode?: number;
        setHeader?: (k: string, v: string) => void;
        end?: (body?: Uint8Array) => void;
      }
    | undefined;

  if (nodeRes && typeof nodeRes.setHeader === "function" && typeof nodeRes.end === "function") {
    nodeRes.statusCode = response.status;
    response.headers.forEach((value, key) => nodeRes.setHeader!(key, value));
    nodeRes.end(new Uint8Array(await response.arrayBuffer()));
    return undefined;
  }

  // Web-standard invocation: return the Response directly.
  return response;
}
