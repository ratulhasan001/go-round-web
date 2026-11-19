import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authEnabled, clientIp, isAuthed, SESSION_COOKIE } from "@/lib/server/auth";
import { alertLater, logEvent, loggedIn, securityLink, whoLine } from "@/lib/server/adminEvents";
import { verifyAdminPassword } from "@/lib/server/adminPassword";
import { humanCheck, startAttempt, triesLeft, turnstileSiteKey, wrongMessage } from "@/lib/server/loginGuard";
import { dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const host = (req: Request) => req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";

/** What the login page needs: whether this device is already logged in, and the human check's site key. */
export async function GET() {
  return NextResponse.json({
    authed: authEnabled() ? await isAuthed((await cookies()).get(SESSION_COOKIE)?.value) : true,
    turnstile: turnstileSiteKey() || null,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown; turnstile?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = clientIp(req);

  if (!authEnabled()) return NextResponse.json({ ok: true });
  if (!dbEnabled()) return NextResponse.json({ error: "nodb", message: "The login needs the database (DATABASE_URL)." }, { status: 503 });
  if (!(await humanCheck(body?.turnstile, ip, host(req), "admin-login")))
    return NextResponse.json({ error: "human", message: "Please tick “Verify you are human” first." }, { status: 400 });

  const attempt = await startAttempt(ip);
  if (!attempt.ok) return NextResponse.json({ error: "locked", message: attempt.message }, { status: attempt.status });

  if (!(await verifyAdminPassword(password))) {
    const lockedFor = await attempt.failed();
    await logEvent(req, "wrong-password");
    if (lockedFor > 0) {
      await logEvent(req, "locked", `${lockedFor} min`);
      alertLater("Login locked after wrong passwords", [whoLine(req), `Locked for ${lockedFor} minutes.`, "If this wasn't you, someone is trying to guess your password.", securityLink()]);
    }
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "wrong", message: wrongMessage("Wrong password.", lockedFor, await triesLeft(ip)) }, { status: 401 });
  }
  await attempt.passed();
  await loggedIn(req, "password");
  return NextResponse.json({ ok: true });
}
