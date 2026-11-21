import { NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/**
 * Public: whether the website can reach its database - for the uptime check (.github/workflows/uptime.yml), which
 * asks once an hour (every question wakes the database for a few minutes). Says nothing else about the shop.
 */
export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ ok: false }, { status: 503, headers: noStore });
  try {
    await db()`select 1`;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("health check: the database can't be reached", e);
    return NextResponse.json({ ok: false }, { status: 503, headers: noStore });
  }
}
