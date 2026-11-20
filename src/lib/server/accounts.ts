import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db, dbEnabled, ensureSchema } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const PROD = process.env.NODE_ENV === "production";
/**
 * Customer login cookie. `__Host-`: the browser only accepts it over https, for this exact address, from the whole
 * site's root - so no other address (even one of our subdomains) can plant or overwrite it. SameSite stays "lax" so a
 * customer who opens the shop from a WhatsApp link is still logged in.
 */
export const CUSTOMER_COOKIE = PROD ? "__Host-gr_customer" : "gr_customer";
/** The name it had before (2026-11-20); those logins are no longer accepted, and the cookie is cleared when seen. */
const OLD_CUSTOMER_COOKIE = "gr_customer";
/** A login lasts this long since the customer last used the site (it renews itself, at most once a day). */
const SESSION_DAYS = 30;

export interface Account {
  id: string;
  phone: string;
  name: string;
  email: string;
  address: string;
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function checkPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = await scryptAsync(pw, Buffer.from(salt, "base64url"), want.length);
  return timingSafeEqual(got, want);
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Logs the account in on this browser (a random token in an httpOnly cookie; only its hash is stored). */
export async function startSession(accountId: string) {
  const token = randomBytes(24).toString("base64url");
  await db()`
    insert into gr_sessions (token_hash, account_id, expires_at)
    values (${sha(token)}, ${accountId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  await db()`delete from gr_sessions where expires_at < now()`;
  const jar = await cookies();
  setCookie(jar, token);
  if (OLD_CUSTOMER_COOKIE !== CUSTOMER_COOKIE) jar.delete(OLD_CUSTOMER_COOKIE);
}

function setCookie(jar: Awaited<ReturnType<typeof cookies>>, token: string) {
  jar.set(CUSTOMER_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: PROD, path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token && dbEnabled()) await db()`delete from gr_sessions where token_hash = ${sha(token)}`.catch(() => null);
  jar.delete(CUSTOMER_COOKIE);
  if (OLD_CUSTOMER_COOKIE !== CUSTOMER_COOKIE) jar.delete(OLD_CUSTOMER_COOKIE);
}

/** Logs the account out everywhere except this browser (after a password change). */
export async function endOtherSessions(accountId: string) {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value ?? "";
  await db()`delete from gr_sessions where account_id = ${accountId} and token_hash <> ${sha(token)}`;
}

/**
 * The logged-in customer, or null. Using the site keeps the login going: once a day at most, the session is pushed
 * back to SESSION_DAYS from now. Only for route handlers (it may set the cookie).
 */
export async function currentAccount(): Promise<Account | null> {
  if (!dbEnabled()) return null;
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  try {
    await ensureSchema();
    const [a] = await db()<(Account & { renew: boolean })[]>`
      select a.id, a.phone, a.name, a.email, a.address,
             s.expires_at < now() + make_interval(days => ${SESSION_DAYS - 1}) as renew
      from gr_sessions s join gr_accounts a on a.id = s.account_id
      where s.token_hash = ${sha(token)} and s.expires_at > now()`;
    if (!a) return null;
    const { renew, ...account } = a;
    if (renew) {
      try {
        await db()`update gr_sessions set expires_at = now() + make_interval(days => ${SESSION_DAYS}) where token_hash = ${sha(token)}`;
        setCookie(jar, token);
      } catch {
        /* still logged in; it renews on the next visit */
      }
    }
    return account;
  } catch {
    return null;
  }
}

export const newAccountId = () => randomUUID();

/** A short password the shop can give a customer who forgot theirs (no 0/O or 1/l to misread). */
export const tempPassword = () => [...randomBytes(8)].map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
