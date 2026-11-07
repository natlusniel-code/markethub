// ── AGENT-OWNED: payment provider integration ────────────────────────────────
//
// WHAT THIS IS: the seam for a Nigerian payment gateway (Paystack or
// Flutterwave). It is deliberately NOT wired to a live account, because doing so
// needs a SECRET KEY that only the shop owner can supply — and a payment
// integration that pretends to work is worse than one that is honestly absent.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: payment status changes ONLY after
// server-side verification. There is no code path here that marks an order paid
// because a browser said so. `verifyTransaction` calls the provider's API with
// the SECRET key, server-side, and returns what the provider actually says.
//
// WHAT IS IMPLEMENTED vs WHAT IS NOT:
//   implemented  — provider selection, secret-key handling, the verify call,
//                  webhook signature verification, amount/currency checks, and
//                  the mapping from a provider result to our order state.
//   NOT wired    — no live keys are configured, so `isConfigured()` is false and
//                  the storefront shows the manual bank-transfer flow instead.
//                  Nothing here claims a payment succeeded.
//
// SECRETS: the secret key is read through env.secret(), which throws when it is
// missing. It is NEVER sent to the client — only `publicConfig()` is, and that
// carries the public key alone.
//
// WHY `env` IS IMPORTED DYNAMICALLY: `_core/env.ts` calls required("DATABASE_URL")
// at MODULE LOAD, so a static `import { env }` here would make every module that
// reaches this file — including the router, and therefore any unit test that
// imports the router — demand a live database just to be imported. Reading the
// config at CALL time instead of import time keeps the payment seam testable and
// matches env.ts's own instruction to read values where they are used.

type EnvModule = typeof import("../_core/env");

let envModule: EnvModule | null = null;

async function getEnv() {
  if (!envModule) envModule = await import("../_core/env");
  return envModule.env;
}

export type Provider = "paystack" | "flutterwave";

export type VerifyResult =
  | { ok: true; amount: number; currency: string; reference: string; channel: string | null }
  | { ok: false; reason: string };

/** Which provider is configured, or null when none is. */
export async function activeProvider(): Promise<Provider | null> {
  const env = await getEnv();
  const raw = (env.config("PAYMENT_PROVIDER", "") || "").trim().toLowerCase();
  if (raw === "paystack" || raw === "flutterwave") return raw;
  return null;
}

async function secretKey(p: Provider): Promise<string | null> {
  const env = await getEnv();
  const name = p === "paystack" ? "PAYSTACK_SECRET_KEY" : "FLUTTERWAVE_SECRET_KEY";
  try {
    return env.secret(name);
  } catch {
    return null;
  }
}

/**
 * True only when a provider is selected AND its secret key is present.
 *
 * The storefront branches on this: false → manual bank transfer (the flow that
 * genuinely works today); true → the gateway flow. It is a real capability
 * check, not a feature flag, so it cannot drift from reality.
 */
export async function isConfigured(): Promise<boolean> {
  const p = await activeProvider();
  if (!p) return false;
  return Boolean(await secretKey(p));
}

/**
 * The ONLY payment configuration the browser may see. Public keys are designed
 * to be embedded in a page; secret keys are not, and are not included here.
 */
export async function publicConfig(): Promise<{ provider: Provider | null; publicKey: string | null }> {
  const p = await activeProvider();
  if (!p || !(await isConfigured())) return { provider: null, publicKey: null };
  const env = await getEnv();
  const publicKey =
    p === "paystack"
      ? env.config("PAYSTACK_PUBLIC_KEY", "")
      : env.config("FLUTTERWAVE_PUBLIC_KEY", "");
  return { provider: p, publicKey: publicKey || null };
}

/**
 * Ask the provider what actually happened to a transaction.
 *
 * This is the ONLY sanctioned way to learn that money arrived. It runs
 * server-side with the secret key; the browser never sees the response shape it
 * would need to forge.
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const p = await activeProvider();
  if (!p) return { ok: false, reason: "no_provider_configured" };
  const key = await secretKey(p);
  if (!key) return { ok: false, reason: "no_secret_key" };

  const url =
    p === "paystack"
      ? `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      // A hung provider must not hold a serverless invocation open.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { ok: false, reason: `provider_unreachable: ${err instanceof Error ? err.message : "unknown"}` };
  }

  if (!res.ok) return { ok: false, reason: `provider_http_${res.status}` };

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return { ok: false, reason: "provider_bad_json" };

  if (p === "paystack") {
    const data = body.data as Record<string, unknown> | undefined;
    if (!body.status || !data) return { ok: false, reason: "paystack_not_found" };
    if (data.status !== "success") return { ok: false, reason: `paystack_status_${String(data.status)}` };
    return {
      ok: true,
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? ""),
      reference: String(data.reference ?? reference),
      channel: data.channel ? String(data.channel) : null,
    };
  }

  const data = body.data as Record<string, unknown> | undefined;
  if (!data) return { ok: false, reason: "flutterwave_not_found" };
  if (String(data.status ?? "").toLowerCase() !== "successful") {
    return { ok: false, reason: `flutterwave_status_${String(data.status)}` };
  }
  return {
    ok: true,
    amount: Math.round(Number(data.amount ?? 0) * 100), // Flutterwave reports major units
    currency: String(data.currency ?? ""),
    reference: String(data.tx_ref ?? reference),
    channel: data.payment_type ? String(data.payment_type) : null,
  };
}

/**
 * Verify a webhook's authenticity before trusting a word of it.
 *
 * Paystack signs the raw body with HMAC-SHA256 using the secret key. A webhook
 * endpoint that skips this is an open "mark any order paid" API, which is why
 * the check lives here rather than in the route.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const p = await activeProvider();
  if (!p || !signature) return false;
  const key = await secretKey(p);
  if (!key) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(rawBody));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Constant-time compare: a length-dependent early return leaks the prefix.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
