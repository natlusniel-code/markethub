import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash as bcryptHash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "./db";
import { isUniqueViolation } from "./db-errors";
import { profiles, users } from "../../drizzle/schema";
import { env } from "./env";
import { sessionCookieName, type UserRole } from "../../shared/constants";
import type { SessionUser } from "../../shared/types";
import { normalizePhone } from "../../shared/phone";
import {
  requestIsSecure,
  sessionCookieClearOptions,
  sessionCookieOptions,
} from "./session-cookie";

// ─────────────────────────────────────────────────────────────────────────────
// AuthProvider abstraction (DESIGN §5.1). Business code depends only on the
// SessionUser it yields, NEVER on how the user authenticated. M1 wires only
// LocalAuthProvider; SsoAuthProvider is a reserved stub. Swapping/adding a
// provider later touches only this file + config — zero business-code churn.
// ─────────────────────────────────────────────────────────────────────────────
export interface AuthProvider {
  /** Resolve the current user from the request, or null if unauthenticated. */
  getSession(c: Context): Promise<SessionUser | null>;
  /** Begin a session (sets the auth cookie). Throws on bad credentials. */
  login(c: Context, email: string, password: string): Promise<SessionUser>;
  /**
   * Begin a session from a phone number instead of an email.
   *
   * Part of the interface rather than a concrete-class extra so a second
   * provider cannot be added that silently lacks phone sign-in — the compiler
   * makes it implement this.
   */
  loginWithPhone(c: Context, phone: string, password: string): Promise<SessionUser>;
  /** End the current session (clears the auth cookie). */
  logout(c: Context): Promise<void>;
}

const COOKIE = sessionCookieName(env.appSlug);
const secretKey = new TextEncoder().encode(env.jwtSecret);

function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  // password_hash is intentionally dropped here — never leaves the auth layer.
  return { id: row.id, email: row.email, name: row.name, role: row.role as UserRole };
}

class LocalAuthProvider implements AuthProvider {
  async getSession(c: Context): Promise<SessionUser | null> {
    const token = getCookie(c, COOKIE);
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, secretKey);
      const userId = payload.sub;
      if (!userId) return null;
      const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return row ? toSessionUser(row) : null;
    } catch {
      return null; // expired / tampered / wrong key → treat as anonymous
    }
  }

  async login(c: Context, email: string, password: string): Promise<SessionUser> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    // Constant-ish: still run a compare when the user is missing to blunt timing.
    const hash = row?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await compare(password, hash);
    if (!row || !row.passwordHash || !ok) throw new AuthError("Invalid email or password");
    await this.#setSession(c, row.id);
    return toSessionUser(row);
  }

  /**
   * Sign in with a phone number instead of an email.
   *
   * The number is normalised FIRST, so "0803 000 0000" and "+2348030000000"
   * resolve to the same account. The lookup goes through `profiles.phone`
   * (the canonical column) rather than the placeholder email, so an account
   * created by email and later given a phone number is reachable both ways.
   */
  async loginWithPhone(c: Context, phone: string, password: string): Promise<SessionUser> {
    const canonical = normalizePhone(phone);
    // Same constant-ish compare as the email path: an unknown number must not
    // answer measurably faster than a wrong password.
    const hash = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    if (!canonical) {
      await compare(password, hash);
      throw new AuthError("Invalid phone number or password");
    }
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.phone, canonical))
      .limit(1);
    const [row] = profile
      ? await db.select().from(users).where(eq(users.id, profile.userId)).limit(1)
      : [];
    const ok = await compare(password, row?.passwordHash ?? hash);
    if (!row || !row.passwordHash || !ok) throw new AuthError("Invalid phone number or password");
    await this.#setSession(c, row.id);
    return toSessionUser(row);
  }

  async logout(c: Context): Promise<void> {
    for (const opt of sessionCookieClearOptions()) {
      deleteCookie(c, COOKIE, opt);
    }
  }

  async #setSession(c: Context, userId: string): Promise<void> {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secretKey);
    setCookie(c, COOKIE, token, sessionCookieOptions(env.isProd || requestIsSecure(c)));
  }
}

// Reserved for post-M1 SSO (OIDC / Teamily IdP). NOT implemented — its presence
// only proves the seam holds; it is never wired in M1 (DESIGN §5.1).
class SsoAuthProvider implements AuthProvider {
  async getSession(): Promise<SessionUser | null> {
    throw new Error("SsoAuthProvider not implemented (reserved seam — DESIGN §5.1).");
  }
  async login(): Promise<SessionUser> {
    throw new Error("SsoAuthProvider not implemented (reserved seam — DESIGN §5.1).");
  }
  async loginWithPhone(): Promise<SessionUser> {
    throw new Error("SsoAuthProvider not implemented (reserved seam — DESIGN §5.1).");
  }
  async logout(): Promise<void> {
    throw new Error("SsoAuthProvider not implemented (reserved seam — DESIGN §5.1).");
  }
}

// An app built without user accounts: nobody can ever be signed in, and any
// attempt to log in is refused. This throws TRPCError (FORBIDDEN) rather than
// AuthError on purpose: authRouter.signup only translates EmailTakenError and
// rethrows everything else, so an AuthError would surface as a 500.
const NO_ACCOUNTS_MESSAGE = "This app does not have user accounts.";
function noAccountsError(): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message: NO_ACCOUNTS_MESSAGE });
}

class NoAuthProvider implements AuthProvider {
  async getSession(): Promise<SessionUser | null> {
    return null;
  }
  async login(): Promise<SessionUser> {
    throw noAccountsError();
  }
  async loginWithPhone(): Promise<SessionUser> {
    throw noAccountsError();
  }
  async logout(): Promise<void> {
    // No session exists, so there is nothing to clear.
  }
}

export class AuthError extends Error {}

/** Signup hit the `users.email` UNIQUE index — that address already has an
 *  account. A distinct type (not a string match on some driver's wording) so a
 *  router can answer 409 "log in instead" instead of leaking a 500. */
export class EmailTakenError extends AuthError {}

/** Signup hit the `profiles.phone` UNIQUE index — that number already has an
 *  account. Separate from EmailTakenError because the two are different fields
 *  and the user must be told WHICH one is taken. */
export class PhoneTakenError extends AuthError {}

// ── phone-as-identifier ──────────────────────────────────────────────────────
// `users.email` is NOT NULL UNIQUE and belongs to the scaffold, so a phone-only
// account still needs a value there. We mint a deterministic, non-routable
// placeholder from the canonical number:
//
//     p2348030000000@phone.markethub.local
//
// Deterministic (not random) on purpose: the existing UNIQUE index then enforces
// one account per number as a second line of defence behind profiles.phone, and
// a retry after a partial failure collides instead of creating a duplicate.
// `.local` is reserved by RFC 6761 and can never be a real mailbox, so nothing
// can be delivered to it and no real address can collide with it.
const PHONE_EMAIL_DOMAIN = "phone.markethub.local";

export function phonePlaceholderEmail(canonicalPhone: string): string {
  return `p${canonicalPhone}@${PHONE_EMAIL_DOMAIN}`;
}

/** True when an address is one of our internal phone placeholders. */
export function isPhonePlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

let _provider: AuthProvider | undefined;
export function authProvider(): AuthProvider {
  if (!_provider) {
    // Anything other than "none" / "sso" (including a typo) falls back to local.
    _provider =
      env.authProvider === "none"
        ? new NoAuthProvider()
        : env.authProvider === "sso"
          ? new SsoAuthProvider()
          : new LocalAuthProvider();
  }
  return _provider;
}

/** False when the app was built without user accounts (AUTH_PROVIDER=none). */
export function accountsEnabled(): boolean {
  return env.authProvider !== "none";
}

// Local-only helper for the signup flow (registration is inherently
// provider-specific; SSO signup happens at the IdP). Kept out of the interface.
export async function registerLocalUser(email: string, password: string, name?: string): Promise<SessionUser> {
  if (env.authProvider === "none") throw noAccountsError();
  const passwordHash = await bcryptHash(password, 10);
  try {
    const [row] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash, name: name ?? null })
      .returning();
    return { id: row.id, email: row.email, name: row.name, role: row.role as UserRole };
  } catch (e) {
    // `users` carries exactly one UNIQUE index (email) — `id` is generated — so
    // a 23505 on this INSERT can only mean the address is taken. Translating it
    // HERE, rather than in each app's routers.ts, is what keeps a second signup
    // from surfacing as a 500 that quotes the INSERT and its bound params
    // (password hash included) back to the browser.
    if (isUniqueViolation(e)) {
      throw new EmailTakenError("That email is already registered — try logging in instead.");
    }
    throw e;
  }
}

/**
 * Register with a phone number as the primary identifier.
 *
 * Two writes, and the ORDER matters: the `users` row first (it owns the id),
 * then the `profiles` row carrying the canonical phone. If the profile insert
 * loses the race on `profiles_phone_uq`, the user row is deleted again so a
 * failed signup does not leave an orphan account that can never be signed into
 * (its placeholder email is unreachable, so the user could not recover it).
 */
export async function registerLocalUserWithPhone(
  phone: string,
  password: string,
  fullName: string,
): Promise<{ user: SessionUser; canonicalPhone: string }> {
  if (env.authProvider === "none") throw noAccountsError();

  const canonical = normalizePhone(phone);
  if (!canonical) throw new AuthError("Enter a valid Nigerian mobile number.");

  // Check first for a clear message; the UNIQUE index below is the real guard.
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.phone, canonical))
    .limit(1);
  if (existing) throw new PhoneTakenError("That phone number is already registered — try logging in instead.");

  const passwordHash = await bcryptHash(password, 10);
  let created: typeof users.$inferSelect;
  try {
    const [row] = await db
      .insert(users)
      .values({
        email: phonePlaceholderEmail(canonical),
        passwordHash,
        name: fullName,
      })
      .returning();
    created = row;
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new PhoneTakenError("That phone number is already registered — try logging in instead.");
    }
    throw e;
  }

  try {
    await db.insert(profiles).values({ userId: created.id, fullName, phone: canonical });
  } catch (e) {
    // Roll the user row back so the number is genuinely free to retry.
    await db.delete(users).where(eq(users.id, created.id)).catch(() => undefined);
    if (isUniqueViolation(e)) {
      throw new PhoneTakenError("That phone number is already registered — try logging in instead.");
    }
    throw e;
  }

  return {
    user: { id: created.id, email: created.email, name: created.name, role: created.role as UserRole },
    canonicalPhone: canonical,
  };
}
