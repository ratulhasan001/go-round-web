import { NextResponse } from "next/server";
import { authEnabled, checkPassword, clientIp, isAuthed, pinLength, SESSION_COOKIE, startSession } from "@/lib/server/auth";
import { cookies } from "next/headers";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Guessing limits: a device gets 5 wrong PINs per 15 minutes, and everyone together 30 per hour (a PIN has few
// combinations, so many devices guessing at once must be stopped too).
const PER_IP = 5;
const PER_IP_MIN = 15;
const ALL = 30;
const ALL_MIN = 60;

/** How many digits the keypad shows, and whether this device is already logged in (the login page then moves on). */
export async function GET() {
  return NextResponse.json({ length: pinLength(), authed: authEnabled() ? await isAuthed((await cookies()).get(SESSION_COOKIE)?.value) : true });
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

  if (authEnabled() && !dbEnabled()) return NextResponse.json({ error: "nodb", message: "The login needs the database (DATABASE_URL)." }, { status: 503 });
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  // right PIN: this device's attempts are forgiven, and old entries are tidied away
  if (limited) await db()`delete from gr_login_fails where ip = ${ip} or at < now() - interval '1 day'`.catch(() => null);

  if (authEnabled()) await startSession(req, "password");
  return NextResponse.json({ ok: true });
}
