import { NextResponse } from "next/server";
import { adminAuthed, currentSessionId, endSessions } from "@/lib/server/auth";
import { passwordProblem, passwordStatus, setAdminPassword, verifyAdminPassword } from "@/lib/server/adminPassword";
import { dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ custom: false, changedAt: null, db: false });
  return NextResponse.json({ ...(await passwordStatus()), db: true });
}

/** Changes the admin password ({ current, next }); every other device is logged out. */
export async function POST(req: Request) {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "nodb", message: "Needs the database." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";
  if (!(await verifyAdminPassword(current))) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "current", message: "Your current password is wrong." }, { status: 400 });
  }
  const problem = passwordProblem(next);
  if (problem) return NextResponse.json({ error: "weak", message: problem }, { status: 400 });
  if (next === current) return NextResponse.json({ error: "same", message: "That's the password you have now. Choose a new one." }, { status: 400 });
  await setAdminPassword(next);
  await endSessions({ except: (await currentSessionId()) ?? "-" });
  return NextResponse.json({ ok: true });
}
