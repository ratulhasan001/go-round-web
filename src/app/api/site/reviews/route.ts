import { NextResponse } from "next/server";
import { clientIp } from "@/lib/server/auth";
import { allow, tooMany } from "@/lib/server/rateLimit";
import { dbEnabled } from "@/lib/server/db";
import { ReviewError, addReview, loadReviews } from "@/lib/server/reviews";

export const dynamic = "force-dynamic";

/** Public: approved reviews of a product (?product=<id>), or the newest ones across the shop. */
export async function GET(req: Request) {
  const product = new URL(req.url).searchParams.get("product") ?? undefined;
  return NextResponse.json({ reviews: await loadReviews(product?.slice(0, 100), product ? 50 : 12) });
}

/** Public: a customer writes a review. */
export async function POST(req: Request) {
  if (!(await allow(`review:${clientIp(req)}`, 10, 60))) return tooMany("You've sent several reviews already. Please try again later.");
  if (!dbEnabled()) return NextResponse.json({ error: "offline", message: "Reviews aren't switched on yet." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return NextResponse.json({ error: "bad request", message: "Please refresh the page and try again." }, { status: 400 });
  }
  // bots fill the hidden trap field (gr_hp), but so do some phone browsers' autofill - so a filled trap never refuses the
  // review, it only holds it back until the shop approves it
  const suspect = typeof body.gr_hp === "string" && !!body.gr_hp.trim();
  try {
    return NextResponse.json({ ok: true, ...(await addReview(body, { hold: suspect })) });
  } catch (e) {
    if (e instanceof ReviewError) return NextResponse.json(e.body, { status: e.status });
    console.error("POST /api/site/reviews failed", e);
    return NextResponse.json({ error: "unavailable", message: "Something went wrong on our side. Please try again in a minute." }, { status: 503 });
  }
}
