import { NextResponse } from "next/server";
import { adminAuthed } from "@/lib/server/auth";
import { alertChannels } from "@/lib/server/adminEvents";
import { passwordStatus } from "@/lib/server/adminPassword";
import { turnstileSiteKey } from "@/lib/server/loginGuard";
import { hasPasskeys } from "@/lib/server/passkeys";
import { secretReady, twoFactorOn } from "@/lib/server/twoFactor";
import { dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** What is set up and what isn't, for the checklist at the top of Login & security. */
export async function GET() {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = dbEnabled();
  const a = alertChannels();
  return NextResponse.json({
    password: db && (await passwordStatus()).custom,
    twoFactor: db && (await twoFactorOn()),
    passkey: db && (await hasPasskeys()),
    sessionSecret: secretReady(),
    turnstile: !!turnstileSiteKey(),
    alerts: a.telegram || a.email,
  });
}
