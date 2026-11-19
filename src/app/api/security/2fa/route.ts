import { NextResponse } from "next/server";
import { adminAuthed, clientIp } from "@/lib/server/auth";
import { alertLater, logEvent, securityLink, whoLine } from "@/lib/server/adminEvents";
import { verifyAdminPassword } from "@/lib/server/adminPassword";
import { startAttempt, wrongMessage } from "@/lib/server/loginGuard";
import { checkCode, confirmSetup, makeRecoveryCodes, secretReady, startSetup, turnOff, twoFactorOn, twoFactorStatus } from "@/lib/server/twoFactor";
import { dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: "bad", message }, { status });

export async function GET() {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ on: false, recoveryLeft: 0, secretReady: secretReady(), secretWorks: true, db: false });
  return NextResponse.json({ ...(await twoFactorStatus()), db: true });
}

/**
 * { action: "start", password }       → a new secret as a QR code
 * { action: "confirm", code }         → turns it on; answers the recovery codes
 * { action: "recovery", password, code } → new recovery codes (the old ones stop working)
 * { action: "off", password, code }   → turns it off
 * The password is asked again so that a device left logged in can't change how the login works.
 */
export async function POST(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return bad("Needs the database.");
  const body = (await req.json().catch(() => null)) as { action?: unknown; password?: unknown; code?: unknown } | null;
  const action = body?.action;
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (action === "confirm") {
    const codes = await confirmSetup(code);
    if (!codes) return bad("That code isn't right. Check the time on your phone is set automatically, and type the newest code.");
    await logEvent(req, "2fa-on");
    alertLater("Two-step login turned on", [whoLine(req), securityLink()]);
    return NextResponse.json({ ok: true, codes });
  }

  if (action !== "start" && action !== "recovery" && action !== "off") return bad("Unknown action.");
  if (action === "start" && !secretReady()) return bad("First add SESSION_SECRET in Vercel (see the steps on this page), then try again.");
  if (action === "start" && (await twoFactorOn())) return bad("Two-step login is already on.");

  const attempt = await startAttempt(clientIp(req));
  if (!attempt.ok) return bad(attempt.message, 429);
  if (!(await verifyAdminPassword(password))) {
    const lockedFor = await attempt.failed();
    await logEvent(req, "wrong-password", "in two-step login settings");
    return bad(wrongMessage("Your password is wrong.", lockedFor));
  }
  if (action !== "start") {
    if (!(await twoFactorOn())) return bad("Two-step login is off.");
    if (!(await checkCode(code))) {
      const lockedFor = await attempt.failed();
      await logEvent(req, "wrong-code", "in two-step login settings");
      return bad(wrongMessage("That code isn't right.", lockedFor));
    }
  }
  await attempt.passed();

  if (action === "start") return NextResponse.json({ ok: true, ...(await startSetup()) });
  if (action === "recovery") {
    await logEvent(req, "recovery-codes");
    return NextResponse.json({ ok: true, codes: await makeRecoveryCodes() });
  }
  await turnOff();
  await logEvent(req, "2fa-off");
  alertLater("Two-step login turned OFF", [whoLine(req), "Logging in now needs only the password.", "If this wasn't you, change your password and turn it back on.", securityLink()]);
  return NextResponse.json({ ok: true });
}
