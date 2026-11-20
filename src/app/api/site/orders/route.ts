import { NextResponse } from "next/server";
import { currentAccount, startSession, hashPassword, newAccountId } from "@/lib/server/accounts";
import { db, dbEnabled, ensureSchema } from "@/lib/server/db";
import { OrderError, orderView, placeOrder } from "@/lib/server/orders";
import { phoneKey } from "@/lib/phone";
import { clientIp } from "@/lib/server/auth";
import { record, reached, tooMany } from "@/lib/server/rateLimit";
import { couponAttempt } from "@/lib/server/couponLimit";

export const dynamic = "force-dynamic";

/** Public: places an order from the website checkout (as a guest, logged in, or creating an account on the way). */
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "offline", message: "Online ordering isn't switched on yet. Please order on WhatsApp." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return NextResponse.json({ error: "bad request", message: "Please refresh the page and try again." }, { status: 400 });
  }
  // There is no hidden bot-trap field here any more: some phone browsers autofilled it ("website", later "gr_hp") and real
  // orders were refused with "Please refresh the page and try again". Orders wait for a hand-checked payment anyway, and
  // the limits below stop floods.

  // at most 5 orders an hour for one phone number, and 20 from one internet address (shared by many mobile users);
  // only orders that go through count, so a form sent back for a missing field doesn't use one up
  const ip = clientIp(req);
  const phone = phoneKey(String(body.phone ?? "")) || "none";
  if ((await reached(`order:ip:${ip}`, 20, 60)) || (await reached(`order:phone:${phone}`, 5, 60)))
    return tooMany("You've placed several orders in the last hour. Please wait a little, or message us on WhatsApp.");

  // an order with a coupon counts as a coupon try (so codes can't be guessed by placing orders either)
  if (typeof body.coupon === "string" && body.coupon.trim() && !(await couponAttempt(req)))
    return tooMany("You've tried several coupon codes. Please wait a few minutes and try again.");

  try {
    await ensureSchema();
    const account = await currentAccount();
    const password = typeof body.password === "string" ? body.password : "";
    if (!account && password) {
      if (password.length < 8) throw new OrderError(422, { error: "invalid", fields: { password: "Use at least 8 characters." } });
      const key = phoneKey(String(body.phone ?? ""));
      const [taken] = await db()`select 1 from gr_accounts where phone_key = ${key}`;
      if (taken) throw new OrderError(422, { error: "invalid", fields: { password: "This number already has an account - log in instead, or untick “Create an account”." } });
    }
    const order = await placeOrder(body, account?.id ?? null);
    await record(`order:ip:${ip}`);
    await record(`order:phone:${phoneKey(order.customer.phone) || phone}`);
    if (!account && password) {
      // the order is already saved: if making the account fails, still tell the customer their order is in
      try {
      // the order is in; now make the account it belongs to
      const id = newAccountId();
      await db()`
        insert into gr_accounts (id, phone_key, phone, name, email, address, pass_hash)
        values (${id}, ${phoneKey(order.customer.phone)}, ${order.customer.phone}, ${order.customer.name}, ${order.customer.email ?? ""}, ${order.customer.address}, ${await hashPassword(password)})
        on conflict (phone_key) do nothing`;
      const next = { ...order, accountId: id };
      await db()`update gr_docs set data = ${db().json(next as never)} where kind = 'order' and id = ${order.id}`;
      await startSession(id);
      return NextResponse.json({ ok: true, order: orderView(next), created: true });
      } catch (e) {
        console.error("account after order failed", e);
        return NextResponse.json({ ok: true, order: orderView(order), created: false });
      }
    }
    return NextResponse.json({ ok: true, order: orderView(order), created: false });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json(e.body, { status: e.status });
    console.error("POST /api/site/orders failed", e);
    return NextResponse.json({ error: "unavailable", message: "Something went wrong on our side. Please try again in a minute." }, { status: 503 });
  }
}
