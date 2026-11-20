import { NextResponse } from "next/server";
import { tooMany } from "@/lib/server/rateLimit";
import { couponAttempt } from "@/lib/server/couponLimit";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";
import { couponKey, couponLabel, websiteCouponProblem } from "@/lib/couponRules";
import type { CouponCode } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Public: checks a coupon typed at checkout ({ code, phone, name }) and returns its offer, so the order summary can
 * show the discount. Nothing is reserved here - the coupon is checked again, and taken, when the order is placed.
 * The answer never says who a coupon was given to.
 */
export async function POST(req: Request) {
  if (!(await couponAttempt(req))) return tooMany("You've tried several coupon codes. Please wait a few minutes and try again.");
  if (!dbEnabled()) return NextResponse.json({ error: "offline", message: "Coupons can't be checked right now." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const key = couponKey(String(body?.code ?? "")).slice(0, 40);
  if (!key) return NextResponse.json({ error: "invalid", message: "Please type your coupon code." }, { status: 422 });
  try {
    await ensureSchema();
    const [row] = await db()<{ data: CouponCode }[]>`
      select data from gr_docs where kind = 'coupon' and upper(regexp_replace(data->>'code', '[[:space:]]', '', 'g')) = ${key}`;
    const problem = websiteCouponProblem(row?.data, { phone: String(body?.phone ?? "").slice(0, 30), name: String(body?.name ?? "").slice(0, 80) });
    if (problem) return NextResponse.json({ error: "invalid", message: problem }, { status: 422 });
    const c = row!.data;
    const offer = { code: c.code.trim().toUpperCase(), pct: Number(c.pct) || 0, freeDelivery: !!c.freeDelivery };
    return NextResponse.json({ ok: true, coupon: { ...offer, label: couponLabel(offer), ...(c.validTo ? { validTo: c.validTo } : {}) } }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("POST /api/site/coupon failed", e);
    return NextResponse.json({ error: "unavailable", message: "Coupons can't be checked right now. Please try again in a minute." }, { status: 503 });
  }
}
