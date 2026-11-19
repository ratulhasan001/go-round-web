import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, dbEnabled, ensureSchema } from "./db";

/**
 * Admin login sessions. Each login gets its own random token, kept in an httpOnly cookie on that device; only a hash
 * of it is stored (gr_admin_sessions), so one device can be logged out on its own and a database copy can't be used
 * to log in. A session ends 3 hours after the login, however busy it is.
 */
const PROD = process.env.NODE_ENV === "production";
/** `__Host-`: the browser only accepts it over https, for this exact address, from the whole site's root. */
export const SESSION_COOKIE = PROD ? "__Host-gr_admin" : "gr_admin";
/** The cookie of the old one-for-every-device login, cleared on the next login or logout. */
export const OLD_SESSION_COOKIE = "gr_session";
export const SESSION_HOURS = 3;

/**
 * Login is on when APP_PASSWORD is set (Vercel → Settings → Environment Variables), and always on the live site: if
 * the variable ever goes missing there, nobody gets in rather than everybody.
 */
export const authEnabled = () => !!process.env.APP_PASSWORD || PROD;

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const sameText = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export const clientIp = (req: Request) => req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** "Chrome on Mac", "Safari on iPhone"… for the devices list and login history. */
export function deviceName(ua: string) {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\/|FxiOS/.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [browser || "Browser", os && `on ${os}`].filter(Boolean).join(" ");
}

// A page load asks for several files at once; a session checked a moment ago isn't looked up again for 15 seconds.
// Logging a device out clears it here at once, and on other server instances within those 15 seconds.
const g = globalThis as unknown as { __grSessions?: Map<string, { until: number; checked: number }> };
const seen = (g.__grSessions ??= new Map());
const RECHECK_MS = 15_000;

/** Whether this cookie value belongs to a session that is still open. */
export async function isAuthed(token: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!token || token.length > 100 || !dbEnabled()) return false;
  const key = sha(token);
  const now = Date.now();
  const hit = seen.get(key);
  if (hit && now < hit.until && now - hit.checked < RECHECK_MS) return true;
  try {
    await ensureSchema();
    const [row] = await db()<{ expires_at: Date }[]>`
      update gr_admin_sessions set last_seen = now() where token_hash = ${key} and expires_at > now() returning expires_at`;
    if (!row) {
      seen.delete(key);
      return false;
    }
    if (seen.size > 500) seen.clear();
    seen.set(key, { until: row.expires_at.getTime(), checked: now });
    return true;
  } catch (e) {
    console.error("session check failed", e);
    return false;
  }
}

/** For API routes: is the request from a logged-in admin? */
export async function adminAuthed() {
  return isAuthed((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The session behind this request's cookie (its id, for "this device" in the devices list). */
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !dbEnabled()) return null;
  const [row] = await db()<{ id: string }[]>`select id from gr_admin_sessions where token_hash = ${sha(token)} and expires_at > now()`;
  return row?.id ?? null;
}

export interface SessionInfo {
  id: string;
  device: string;
  ip: string;
  how: string;
  created_at: string;
  last_seen: string;
  expires_at: string;
}

/** Opens a session for this device and sets its cookie. `how` says how it logged in (password, passkey…). */
export async function startSession(req: Request, how: string) {
  const token = randomBytes(32).toString("base64url");
  const ua = req.headers.get("user-agent") ?? "";
  await ensureSchema();
  await db()`
    insert into gr_admin_sessions (token_hash, id, device, ip, ua, how, expires_at)
    values (${sha(token)}, ${randomBytes(9).toString("base64url")}, ${deviceName(ua)}, ${clientIp(req)}, ${ua.slice(0, 300)}, ${how},
            now() + make_interval(hours => ${SESSION_HOURS}))`;
  await db()`delete from gr_admin_sessions where expires_at < now() - interval '1 day'`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: SESSION_HOURS * 60 * 60 });
  jar.delete(OLD_SESSION_COOKIE);
}

/** Logs this device out. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    seen.delete(sha(token));
    if (dbEnabled()) await db()`delete from gr_admin_sessions where token_hash = ${sha(token)}`.catch(() => null);
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(OLD_SESSION_COOKIE);
}

/** The devices logged in right now, newest first. */
export async function listSessions(): Promise<SessionInfo[]> {
  return db()<SessionInfo[]>`
    select id, device, ip, how, created_at, last_seen, expires_at from gr_admin_sessions
    where expires_at > now() order by created_at desc`;
}

/** Logs out one device by its id, or every device but this one (`except`), or every device. */
export async function endSessions(opts: { id?: string; except?: string | null }) {
  if (opts.id) await db()`delete from gr_admin_sessions where id = ${opts.id}`;
  else if (opts.except) await db()`delete from gr_admin_sessions where id <> ${opts.except}`;
  else await db()`delete from gr_admin_sessions`;
  seen.clear();
}
