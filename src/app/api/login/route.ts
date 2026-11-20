import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { authEnabled, clientIp, isAuthed, requestFrom, SESSION_COOKIE } from "@/lib/server/auth";
import { alertLater, logEvent, loggedIn, securityLink, whoLine } from "@/lib/server/adminEvents";
import { passwordProblem, passwordStatus, setAdminPassword, verifyAdminPassword } from "@/lib/server/adminPassword";
import { issueToken, peekToken, updateToken, spendToken } from "@/lib/server/adminTokens";
import { humanCheck, startAttempt, triesLeft, turnstileSiteKey, wrongMessage } from "@/lib/server/loginGuard";
import { checkCode, emailCodeMatches, emailCodeOn, secondStepOn, sendEmailCode, twoFactorStatus, type EmailCode } from "@/lib/server/twoFactor";
import { maskedEmail } from "@/lib/server/adminEvents";
import { dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const host = (req: Request) => req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
const CODE_TRIES = 5; // wrong two-step codes before the password must be typed again
const TICKET_MINUTES = 10;
const EMAIL_SENDS = 3; // email codes per login attempt

interface Ticket {
  tries: number;
  sends: number;
  email?: EmailCode;
}

const emailWhy = "Someone (hopefully you) typed the right admin password.";

/** What the login page needs: whether this device is already logged in, and the human check's site key. */
export async function GET() {
  return NextResponse.json({
    authed: authEnabled() ? await isAuthed((await cookies()).get(SESSION_COOKIE)?.value, requestFrom(await headers())) : true,
    turnstile: turnstileSiteKey() || null,
  });
}

/**
 * Step 1: { password, turnstile }. Logs in, or answers what comes next:
 *         { next: "new-password", ticket } while the login is still the old PIN from Vercel (APP_PASSWORD): the admin
 *         chooses a real password ({ ticket, newPassword }) before getting in, and the PIN stops working;
 *         { next: "code", ticket } with two-step login on.
 * Step 2: { ticket, code }: the code from the authenticator app, the code emailed for this login, or a recovery code.
 *         { ticket, send: "email" }: emails a code (the first one goes out by itself when the app isn't set up).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown; turnstile?: unknown; ticket?: unknown; code?: unknown; send?: unknown; newPassword?: unknown } | null;
  const ip = clientIp(req);

  if (!authEnabled()) return NextResponse.json({ ok: true });
  if (!dbEnabled()) return NextResponse.json({ error: "nodb", message: "The login needs the database (DATABASE_URL)." }, { status: 503 });
  if (body?.ticket !== undefined) {
    if (body.newPassword !== undefined) return newPasswordStep(req, body.ticket, body.newPassword);
    return body.send === "email" ? sendCode(body.ticket) : codeStep(req, ip, body.ticket, body.code);
  }

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

  if (!(await passwordStatus()).custom) {
    // still the PIN: a real password must be chosen first (the PIN was right, but it alone doesn't clear wrong tries)
    await attempt.cancel();
    return NextResponse.json({ next: "new-password", ticket: await issueToken("setpw", 15) });
  }
  if (await secondStepOn()) {
    // the password alone doesn't clear this device's wrong tries: wrong codes keep counting towards a lockout
    await attempt.cancel();
    return NextResponse.json(await codeTicket());
  }
  await attempt.passed();
  await loggedIn(req, "password");
  return NextResponse.json({ ok: true });
}

/** Starts the two-step code: a ticket for it, and which ways of getting the code are on. */
async function codeTicket() {
  const s = await twoFactorStatus();
  const app = s.on && s.secretWorks;
  // without the app, the email code is the way in: send it straight away
  const email = s.email && !app ? await sendEmailCode(emailWhy) : null;
  const t: Ticket = { tries: 0, sends: email ? 1 : 0, ...(email ? { email } : {}) };
  return {
    next: "code",
    ticket: await issueToken("mfa", TICKET_MINUTES, t as unknown as Record<string, unknown>),
    app,
    email: s.email,
    emailTo: s.email ? maskedEmail() : "",
    emailSent: !!email,
    appWorks: s.secretWorks,
    recoveryLeft: s.recoveryLeft,
  };
}

/** The first login after the PIN: the admin's own password replaces it, then the login carries on. */
async function newPasswordStep(req: Request, ticket: unknown, raw: unknown) {
  const pw = typeof raw === "string" ? raw : "";
  if (!(await peekToken("setpw", ticket))) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });
  const problem = passwordProblem(pw);
  if (problem) return NextResponse.json({ error: "weak", message: problem }, { status: 400 });
  if (pw === (process.env.APP_PASSWORD ?? "")) return NextResponse.json({ error: "weak", message: "Choose a new password, not the old PIN." }, { status: 400 });
  if (!(await spendToken("setpw", ticket))) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });
  await setAdminPassword(pw);
  await logEvent(req, "password-changed", "replaced the PIN");
  alertLater("Admin password set", [whoLine(req), "The old PIN no longer works.", "If this wasn't you, change APP_PASSWORD in Vercel to get back in.", securityLink()]);
  if (await secondStepOn()) return NextResponse.json(await codeTicket());
  await loggedIn(req, "password");
  return NextResponse.json({ ok: true });
}

/** Emails a login code for this attempt (at most 3, half a minute apart). */
async function sendCode(ticket: unknown) {
  const t = await peekToken<Ticket>("mfa", ticket);
  if (!t) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });
  if (!(await emailCodeOn())) return NextResponse.json({ error: "off", message: "Email codes aren't turned on." }, { status: 400 });
  if (t.sends >= EMAIL_SENDS) return NextResponse.json({ error: "wait", message: "That's enough emails for one login. Use the newest code you got, or log in again." }, { status: 429 });
  if (t.email && Date.now() - t.email.at < 30_000) return NextResponse.json({ error: "wait", message: "A code was just sent. Wait half a minute before asking again." }, { status: 429 });
  const email = await sendEmailCode(emailWhy);
  if (!email) return NextResponse.json({ error: "failed", message: "The email couldn't be sent. Try again, or use your app or a recovery code." }, { status: 502 });
  await updateToken("mfa", ticket as string, { ...t, sends: t.sends + 1, email });
  return NextResponse.json({ ok: false, sent: true, emailTo: maskedEmail() });
}

async function codeStep(req: Request, ip: string, ticket: unknown, rawCode: unknown) {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  const t = await peekToken<Ticket>("mfa", ticket);
  if (!t) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });

  const attempt = await startAttempt(ip);
  if (!attempt.ok) return NextResponse.json({ error: "locked", message: attempt.message }, { status: attempt.status });

  const how = !code ? null : emailCodeMatches(t.email, code) ? "email" : await checkCode(code);
  if (!how) {
    const lockedFor = await attempt.failed();
    const tries = t.tries + 1;
    if (tries >= CODE_TRIES) await spendToken("mfa", ticket);
    else await updateToken("mfa", ticket as string, { ...t, tries });
    await logEvent(req, "wrong-code");
    // the password was right, so it may be known to someone else
    if (tries === 1) alertLater("Right password, wrong login code", [whoLine(req), "Someone typed your password correctly but not the login code.", "If this wasn't you, change your password now.", securityLink()]);
    await new Promise((r) => setTimeout(r, 600));
    if (tries >= CODE_TRIES) return NextResponse.json({ error: "expired", message: "Too many wrong codes. Please log in again." }, { status: 401 });
    return NextResponse.json({ error: "wrong", message: wrongMessage("That code isn't right.", lockedFor, Math.min(CODE_TRIES - tries, await triesLeft(ip))) }, { status: 401 });
  }

  if (!(await spendToken("mfa", ticket))) return NextResponse.json({ error: "expired", message: "That took too long. Please log in again." }, { status: 400 });
  await attempt.passed();
  await loggedIn(req, how === "app" ? "password+2fa" : how === "email" ? "password+email" : "password+recovery");
  if (how === "recovery") {
    const left = (await twoFactorStatus()).recoveryLeft;
    alertLater("Recovery code used to log in", [whoLine(req), `${left} recovery ${left === 1 ? "code" : "codes"} left.`, securityLink()]);
  }
  return NextResponse.json({ ok: true });
}
