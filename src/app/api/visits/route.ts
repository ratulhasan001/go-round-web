import { NextResponse } from "next/server";
import { adminAuthed } from "@/lib/server/auth";
import { dbEnabled } from "@/lib/server/db";
import { visitHistory } from "@/lib/server/visits";
import { bdToday } from "@/lib/couponRules";

export const dynamic = "force-dynamic";

/** Admin: the store's visitors and visits per day for the last 30 days, today last (Website → Visitors). */
export async function GET() {
  if (!(await adminAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const headers = { "cache-control": "no-store" };
  if (!dbEnabled()) return NextResponse.json({ db: false }, { headers });
  try {
    const today = bdToday();
    return NextResponse.json({ db: true, today, days: await visitHistory(30, today) }, { headers });
  } catch (e) {
    console.error("GET /api/visits failed", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
