// Bundle the Vercel serverless function into ONE self-contained file.
//
// WHY THIS EXISTS — the production failure it fixes
// -------------------------------------------------
// Vercel compiles api/index.ts on its own, but it does NOT bundle that file's
// relative imports. The entry's `import("../server/app")` was therefore left as
// a bare specifier and resolved at runtime to /var/task/server/app — a path that
// does not exist, because Vercel never compiled the server/ tree. Every API call
// answered:
//
//   503 {"error":"server_not_configured",
//        "message":"Cannot find module '/var/task/server/app' imported from
//                   /var/task/api/index.js"}
//
// The fix is to stop relying on Vercel's tracing: we bundle the entry AND every
// module it reaches AND every runtime dependency into a single api/index.js.
// The deployed file then has no relative imports left to miss.
//
// The source of truth is server/vercel-entry.ts. api/index.js is a BUILD
// ARTIFACT and is gitignored — never edit it by hand.
import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

const SRC = "server/vercel-entry.ts";
const OUT = "api/index.js";

// Optional native / edge-only modules that `pg` and friends require behind a
// try/catch. They are never reached on Vercel (no pg-native build, no
// Cloudflare sockets), and leaving them external stops esbuild failing to
// resolve them at build time.
const OPTIONAL_NATIVE = [
  "pg-native",
  "cloudflare:sockets",
  "bufferutil",
  "utf-8-validate",
];

await esbuild.build({
  entryPoints: [SRC],
  outfile: OUT,
  bundle: true,
  platform: "node",
  target: "node20",
  // ESM: package.json declares "type": "module", and Vercel's Node runtime
  // supports ESM functions. esbuild rewrites the CJS dependencies it inlines
  // into ESM-safe wrappers.
  format: "esm",
  sourcemap: false,
  external: OPTIONAL_NATIVE,
  // THE REQUIRE SHIM — without it the bundle dies at import time with
  //   Error: Dynamic require of "events" is not supported
  // `pg` is CommonJS and calls require() for node builtins at runtime. esbuild
  // emits a `__require` helper that only works when a real `require` is in
  // scope, and an ESM module has none. Defining one from node:module makes
  // every inlined CJS dependency behave exactly as it does under CJS.
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

// Vercel builds EVERY file in api/ as its own function, so leaving the
// TypeScript source beside the bundle would register two functions for the same
// route. The bundle is the deployable artifact; the source lives in
// server/vercel-entry.ts and is what you edit.
if (existsSync("api/index.ts")) {
  await rm("api/index.ts");
  console.log("[build-api] removed api/index.ts (superseded by the bundle)");
}

console.log(`[build-api] wrote ${OUT}`);
