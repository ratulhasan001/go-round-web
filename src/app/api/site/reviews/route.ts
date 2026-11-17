import { NextResponse } from "next/server";
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
  if (!dbEnabled()) return NextResponse.json({ error: "offline", message: "Reviews aren't switched on yet." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request", message: "Please refresh the page and try again." }, { status: 400 });
  }
  // bots fill the hidden trap field (gr_hp). The old trap was called "website", which browsers autofilled, so that name is no longer checked
  if (typeof body.gr_hp === "string" && body.gr_hp.trim()) return NextResponse.json({ error: "bad request", message: "Please refresh the page and try again." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await addReview(body)) });
  } catch (e) {
    if (e instanceof ReviewError) return NextResponse.json(e.body, { status: e.status });
    console.error("POST /api/site/reviews failed", e);
    return NextResponse.json({ error: "unavailable", message: "Something went wrong on our side. Please try again in a minute." }, { status: 503 });
  }
}
