import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authEnabled, clientIp, isAuthed, SESSION_COOKIE } from "@/lib/server/auth";
import { alertLater, logEvent, loggedIn, securityLink, whoLine } from "@/lib/server/adminEvents";
import { verifyAdminPassword } from "@/lib/server/adminPassword";
import { issueToken, peekToken, updateToken, spendToken } from "@/lib/server/adminTokens";
import { humanCheck, startAttempt, triesLeft, turnstileSiteKey, wrongMessage } from "@/lib/server/loginGuard";
import { checkCode, twoFactorOn, twoFactorStatus } from "@/lib/server/twoFactor";
import { dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const host = (req: Request) => req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
const CODE_TRIES = 5; // wrong two-step codes before the password must be typed again
const TICKET_MINUTES = 5;

/** What the login page needs: whether this device is already logged in, and the human check's site key. */
export async function GET() {
  return NextResponse.json({
    authed: authEnabled() ? await isAuthed((await cookies()).get(SESSION_COOKIE)?.value) : true,
    turnstile: turnstileSiteKey() || null,
  });
}

/**
 * Step 1: { password, turnstile }. Logs in, or - with two-step login on - answers { next: "code", ticket }.
 * Step 2: { ticket, code }: the code from the authenticator app, or a recovery code.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown; turnstile?: unknown; ticket?: unknown; code?: unknown } | null;
  const ip = clientIp(req);

  if (!authEnabled()) return NextResponse.json({ ok: true });
  if (!dbEnabled()) return NextResponse.json({ error: "nodb", message: "The login needs the database (DATABASE_URL)." }, { status: 503 });
  if (body?.ticket !== undefined) return codeStep(req, ip, body.ticket, body.code);

  const password = typeof body?.password === "string" ? body.password : "";
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

  if (await twoFactorOn()) {
    // the password alone doesn't clear this device's wrong tries: wrong codes keep counting towards a lockout
    await attempt.cancel();
    const s = await twoFactorStatus();
    return NextResponse.json({ next: "code", ticket: await issueToken("mfa", TICKET_MINUTES, { tries: 0 }), appWorks: s.secretWorks, recoveryLeft: s.recoveryLeft });
  }
  await attempt.passed();
  await loggedIn(req, "password");
  return NextResponse.json({ ok: true });
}

async function codeStep(req: Request, ip: string, ticket: unknown, rawCode: unknown) {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  const t = await peekToken<{ tries: number }>("mfa", ticket);
  if (!t) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });

  const attempt = await startAttempt(ip);
  if (!attempt.ok) return NextResponse.json({ error: "locked", message: attempt.message }, { status: attempt.status });

  const how = code ? await checkCode(code) : null;
  if (!how) {
    const lockedFor = await attempt.failed();
    const tries = t.tries + 1;
    if (tries >= CODE_TRIES) await spendToken("mfa", ticket);
    else await updateToken("mfa", ticket as string, { tries });
    await logEvent(req, "wrong-code");
    // the password was right, so it may be known to someone else
    if (tries === 1) alertLater("Right password, wrong login code", [whoLine(req), "Someone typed your password correctly but not the code from your app.", "If this wasn't you, change your password now.", securityLink()]);
    await new Promise((r) => setTimeout(r, 600));
    if (tries >= CODE_TRIES) return NextResponse.json({ error: "expired", message: "Too many wrong codes. Please log in again." }, { status: 401 });
    return NextResponse.json({ error: "wrong", message: wrongMessage("That code isn't right.", lockedFor, Math.min(CODE_TRIES - tries, await triesLeft(ip))) }, { status: 401 });
  }

  if (!(await spendToken("mfa", ticket))) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });
  await attempt.passed();
  await loggedIn(req, how === "app" ? "password+2fa" : "password+recovery");
  if (how === "recovery") {
    const left = (await twoFactorStatus()).recoveryLeft;
    alertLater("Recovery code used to log in", [whoLine(req), `${left} recovery ${left === 1 ? "code" : "codes"} left.`, securityLink()]);
  }
  return NextResponse.json({ ok: true });
}
