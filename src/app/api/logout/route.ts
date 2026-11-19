import { NextResponse } from "next/server";
import { adminAuthed, endSession } from "@/lib/server/auth";
import { logEvent } from "@/lib/server/adminEvents";

export async function POST(req: Request) {
  if (await adminAuthed()) await logEvent(req, "logout");
  await endSession();
  return NextResponse.json({ ok: true });
}
