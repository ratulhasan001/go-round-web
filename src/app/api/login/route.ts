import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, authEnabled, checkPassword, pinLength, sessionToken } from "@/lib/server/auth";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Guessing limits: a device gets 5 wrong PINs per 15 minutes, and everyone together 30 per hour (a PIN has few
// combinations, so many devices guessing at once must be stopped too).
const PER_IP = 5;
const PER_IP_MIN = 15;
const ALL = 30;
const ALL_MIN = 60;

const clientIp = (req: Request) => req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** How many digits the keypad shows. */
export async function GET() {
  return NextResponse.json({ length: pinLength() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = String(body && typeof body === "object" ? (body.password ?? "") : "");
  const ip = clientIp(req);
  const limited = authEnabled() && dbEnabled();

  if (limited) {
    try {
      await ensureSchema();
      // the attempt is written down before it is checked, so many guesses sent at once can't all slip under the limit
      await db()`insert into gr_login_fails (ip) values (${ip})`;
      const [{ mine, total }] = await db()<{ mine: number; total: number }[]>`
        select count(*) filter (where ip = ${ip} and at > now() - make_interval(mins => ${PER_IP_MIN}))::int as mine,
               count(*) filter (where at > now() - make_interval(mins => ${ALL_MIN}))::int as total
        from gr_login_fails`;
      if (mine > PER_IP || total > ALL)
        return NextResponse.json(
          { error: "locked", message: mine > PER_IP ? `Too many wrong PINs. Try again in ${PER_IP_MIN} minutes.` : "Login is paused for a while after many wrong PINs. Try again later." },
          { status: 429 },
        );
    } catch (e) {
      console.error("login limit check failed", e); // never lock the owner out because the database blinked
    }
  }

  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  // right PIN: this device's attempts are forgiven, and old entries are tidied away
  if (limited) await db()`delete from gr_login_fails where ip = ${ip} or at < now() - interval '1 day'`.catch(() => null);

  const res = NextResponse.json({ ok: true });
  if (authEnabled())
    res.cookies.set(SESSION_COOKIE, sessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  return res;
}
