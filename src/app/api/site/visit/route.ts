import { NextResponse } from "next/server";
import { dbEnabled } from "@/lib/server/db";
import { countVisit } from "@/lib/server/visits";
import { isBot } from "@/lib/visits";
import { areaOf } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The browser sends visits without waiting for an answer, so every answer is the same empty one. */
const done = () => new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * Public: a store page tells the server that a visit started (body {"first": true} on the browser's first visit today) -
 * see VisitCounter.tsx. Only the day's totals change; nothing about the visitor is kept, not even the address.
 * Counted only from the store's own pages (a browser always names the page's address), never from bots and scripts.
 * The Vercel Firewall's rate limit on /api/site/ keeps one device from adding much.
 */
export async function POST(req: Request) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  let from = "";
  try {
    from = origin ? new URL(origin).host.toLowerCase() : "";
  } catch {
    /* not a URL */
  }
  if (!from || from !== host || (site && site !== "same-origin")) return done();
  const area = areaOf(host);
  if (area === "admin" || area === "verify") return done(); // store pages only
  if (isBot(req.headers.get("user-agent") ?? "") || !dbEnabled()) return done();

  let first = false;
  try {
    const text = await req.text();
    first = text.length < 200 && (JSON.parse(text) as { first?: unknown })?.first === true;
  } catch {
    /* no body or not JSON: a visit, not a new visitor */
  }
  try {
    await countVisit(first);
  } catch (e) {
    console.error("visit counter: couldn't count a visit", e); // a counter mustn't ever bother a customer
  }
  return done();
}
