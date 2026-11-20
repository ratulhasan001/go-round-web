import type postgres from "postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { clean, normPhone, phoneKey } from "@/lib/phone";
import { cleanCode, deliveryFee, makeOrderCode, needsTrxAtCheckout, onSite, siteSettings, splitPoliceStation, thumb, withPoliceStation } from "@/lib/site";
import { ORDER_PAY_METHODS, type CouponCode, type Invoice, type Order, type OrderItem, type OrderPayMethod, type Product } from "@/lib/types";
import { db } from "./db";
import { loadShop } from "./catalog";
import { syncAccount, upsertCustomer } from "./customers";
import { type OrderCoupon, bdToday, couponAmount, couponKey, websiteCouponProblem } from "@/lib/couponRules";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Fields = Record<string, string>;

/** Name, phone and address as typed at checkout / on an account, cleaned and checked. */
export function readContact(body: Record<string, unknown>) {
  const name = clean(body.name).slice(0, 80);
  const phone = normPhone(clean(body.phone).slice(0, 30));
  const email = clean(body.email).slice(0, 120);
  const address = String(body.address ?? "").trim().replace(/[ \t]+/g, " ").slice(0, 400);
  const errors: Fields = {};
  if (name.length < 2) errors.name = "Please enter your full name.";
  const digits = phoneKey(phone);
  if (!/^01\d{9}$/.test(phone) && (digits.length < 8 || digits.length > 15)) errors.phone = "Please enter a valid WhatsApp number.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "That email doesn't look right.";
  return { name, phone, email, address, errors };
}

export function readPayment(body: Record<string, unknown>) {
  const method = ORDER_PAY_METHODS.includes(body.method as OrderPayMethod) ? (body.method as OrderPayMethod) : null;
  const trxId = clean(body.trxId).toUpperCase().slice(0, 40);
  const sender = clean(body.sender).slice(0, 60);
  return { method, trxId, sender };
}

export class OrderError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.error));
  }
}

/**
 * Places a website order. Prices, stock and delivery come from the database, never from the browser.
 * The customer is also added to (or updated in) the shop's customer list, and a logged-in customer's account takes the
 * details they ordered with (when they ordered for their own number). A guest never changes an account.
 */
export async function placeOrder(body: Record<string, unknown>, accountId: string | null): Promise<Order> {
  const contact = readContact(body);
  const { name, phone, email, errors } = contact;
  // the police station is a must: typed on its own at checkout, kept at the end of the address
  const ps = clean(body.ps).slice(0, 60) || splitPoliceStation(contact.address).ps;
  const address = withPoliceStation(contact.address, ps);
  if (splitPoliceStation(address).address.length < 5) errors.address = "Please enter your full delivery address.";
  if (!ps) errors.ps = "Please enter your police station (thana).";
  if (body.accept !== true) errors.accept = "Please accept the privacy policy, terms and conditions and return policy.";
  const { method, trxId, sender } = readPayment(body);
  if (!method) errors.method = "Please choose how you will pay.";
  const shop = await loadShop();
  const settings = siteSettings(shop);
  // payments are checked by hand, so the order needs the transaction id to approve it (unless the customer has to ask for our bank details first)
  if (method && !trxId && needsTrxAtCheckout(settings, method)) errors.trxId = "Please pay first, then type the transaction ID here.";
  if (Object.keys(errors).length) throw new OrderError(422, { error: "invalid", fields: errors });

  const raw = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  const wanted = new Map<string, number>();
  for (const it of raw as { id?: unknown; qty?: unknown }[]) {
    const id = typeof it?.id === "string" ? it.id.slice(0, 100) : "";
    const qty = Math.floor(Number(it?.qty));
    if (id && qty > 0) wanted.set(id, Math.min(99, (wanted.get(id) ?? 0) + qty));
  }
  if (!wanted.size) throw new OrderError(422, { error: "empty", message: "Your cart is empty." });

  if (!settings.open) throw new OrderError(409, { error: "closed", message: "We're not taking orders on the website right now. Please message us on WhatsApp." });

  // Products are read and their stock taken inside one transaction, with the rows locked: two customers can't both
  // buy the last one, and an admin edit made a moment ago is never overwritten with an older copy.
  const now = Date.now();
  const order = await db().begin(async (tx) => {
    const rows = await tx<{ data: Product }[]>`select data from gr_docs where kind = 'product' and id = any(${[...wanted.keys()]}) for update`;
    const byId = new Map(rows.map((r) => [r.data.id, r.data]));
    const items: OrderItem[] = [];
    const unavailable: string[] = [];
    const short: string[] = []; // fewer in stock than ordered
    for (const [id, qty] of wanted) {
      const p = byId.get(id);
      if (!p || !onSite(p) || p.inStock === false || (typeof p.stock === "number" && p.stock <= 0)) {
        unavailable.push(id);
        continue;
      }
      if (typeof p.stock === "number" && p.stock < qty) {
        short.push(`${p.name.trim()} (only ${p.stock} left)`);
        continue;
      }
      items.push({ productId: id, name: p.name.trim(), unit: p.unit?.trim() || undefined, price: p.price, qty, image: p.images?.[0] ? thumb(p.images[0]) : undefined });
    }
    if (short.length && !unavailable.length)
      throw new OrderError(409, { error: "unavailable", ids: [], message: `We don't have that many of ${short.join(", ")}. We've lowered the quantity in your cart - please check it.` });
    if (unavailable.length)
      throw new OrderError(409, { error: "unavailable", ids: unavailable, message: "Some items in your cart are no longer available. We've removed them - please check your cart." });

    const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
    const weight = Math.round(items.reduce((s, i) => s + (Number(byId.get(i.productId)?.weight) || 0) * i.qty, 0) * 1000) / 1000;
    const { zone, fee, quote } = deliveryFee(settings, String(body.zone ?? ""), subtotal, weight);

    // a coupon typed at checkout: checked again here, with its row locked, so two orders can't both use it
    const couponWanted = couponKey(String(body.coupon ?? "")).slice(0, 40);
    let coupon: { id: string; data: CouponCode; offer: OrderCoupon } | null = null;
    if (couponWanted) {
      const [row] = await tx<{ id: string; data: CouponCode }[]>`
        select id, data from gr_docs where kind = 'coupon' and upper(regexp_replace(data->>'code', '[[:space:]]', '', 'g')) = ${couponWanted} for update`;
      const problem = websiteCouponProblem(row?.data, { phone, name });
      if (problem) throw new OrderError(422, { error: "invalid", fields: { coupon: problem } });
      const c = row!.data;
      const offer = { code: c.code.trim().toUpperCase(), pct: Number(c.pct) || 0, freeDelivery: !!c.freeDelivery, amount: couponAmount(subtotal, fee, c) };
      coupon = { id: row!.id, data: c, offer };
    }

    const order: Order = {
      id: randomUUID(),
      code: "",
      status: "placed",
      history: [{ status: "placed", at: now }],
      customer: { name, phone, address, ...(email ? { email } : {}) },
      ...(accountId ? { accountId } : {}),
      items,
      subtotal,
      delivery: fee,
      zone,
      ...(weight > 0 ? { weight } : {}),
      ...(quote ? { deliveryQuote: true } : {}),
      ...(coupon ? { coupon: coupon.offer } : {}),
      total: round2(subtotal + fee - (coupon?.offer.amount ?? 0)),
      payment: { method: method!, ...(trxId ? { trxId, submittedAt: now } : {}), ...(sender ? { sender } : {}) },
      ...(clean(body.note) ? { note: String(body.note).trim().slice(0, 500) } : {}),
      createdAt: now,
      updatedAt: now,
    };

    // a fresh code (the alphabet has ~887 million six-letter codes, so a clash is rare)
    for (let i = 0; i < 5 && !order.code; i++) {
      const code = makeOrderCode((n) => randomBytes(n));
      const [taken] = await tx`select 1 from gr_docs where kind = 'order' and data->>'code' = ${code}`;
      if (!taken) order.code = code;
    }
    await tx`insert into gr_docs (kind, id, data) values ('order', ${order.id}, ${tx.json(order as never)})`;
    // the coupon is taken by this order (its receipt takes it over when the payment is approved)
    if (coupon) {
      const used: CouponCode = { ...coupon.data, usedOn: bdToday(now), usedOrderId: order.id, usedOrder: order.code, updatedAt: now };
      await tx`update gr_docs set data = ${tx.json(used as never)}, updated_at = now() where kind = 'coupon' and id = ${coupon.id}`;
    }
    // counted stock goes down by what was ordered (and the product sells out at 0)
    await adjustStock(tx, items, -1);
    await upsertCustomer(tx, { name, phone, address, email });
    if (accountId) await syncAccount(tx, { name, phone, address, email }, accountId);
    return order;
  });
  return order;
}

/** The order with this code, if the phone number matches the one it was placed with. */
export async function findOrder(code: string, phone: string): Promise<Order | null> {
  const digits = phoneKey(phone);
  if (digits.length < 6) return null;
  const order = await findOrderByCode(code);
  if (!order) return null;
  const saved = phoneKey(order.customer.phone);
  const same = saved === digits || (saved.length >= 10 && digits.length >= 10 && saved.slice(-10) === digits.slice(-10));
  return same ? order : null;
}

/** The order with this code, without checking who asks - only for callers that already did (e.g. a signed link). */
export async function findOrderByCode(code: string): Promise<Order | null> {
  const c = cleanCode(code);
  if (c.length < 6 || c.length > 12) return null;
  const [row] = await db()<{ data: Order }[]>`select data from gr_docs where kind = 'order' and data->>'code' = ${c}`;
  return row?.data ?? null;
}

/**
 * Every order placed with this mobile number, newest first. Numbers are compared on their last 10 digits, so
 * 01712-345678, +8801712345678 and 8801712345678 are the same number.
 */
export async function findOrdersByPhone(phone: string): Promise<Order[]> {
  const digits = phoneKey(phone);
  if (digits.length < 10 || digits.length > 15) return [];
  const rows = await db()<{ data: Order }[]>`
    select data from gr_docs
    where kind = 'order' and right(regexp_replace(coalesce(data->'customer'->>'phone', ''), '[^0-9]', '', 'g'), 10) = ${digits.slice(-10)}
    order by (data->>'createdAt')::bigint desc limit 20`;
  return rows.map((r) => r.data);
}

/** Transaction ids as typed: upper case, no spaces or dashes. */
export const trxKey = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");

/**
 * The newest order paid with this transaction id (bKash TrxID or bank reference). Knowing it means you made the
 * payment, so it is enough to open the order - but very short ids are refused, as they could be guessed.
 */
export async function findOrderByTrx(trxId: string): Promise<Order | null> {
  const key = trxKey(trxId);
  if (key.length < 6 || key.length > 40) return null;
  const [row] = await db()<{ data: Order }[]>`
    select data from gr_docs
    where kind = 'order' and upper(regexp_replace(coalesce(data->'payment'->>'trxId', ''), '[[:space:]-]', '', 'g')) = ${key}
    order by (data->>'createdAt')::bigint desc limit 1`;
  return row?.data ?? null;
}

/** What the customer sees of an order: everything except the shop's private note. */
export const orderView = (o: Order) => {
  const { adminNote, seen, invoiceId, ...rest } = o;
  void adminNote;
  void seen;
  void invoiceId;
  return rest;
};
export type OrderView = ReturnType<typeof orderView>;

/** Saves payment details the customer adds after ordering (only while the shop hasn't verified a payment). */
export async function addPayment(order: Order, body: Record<string, unknown>) {
  const { method, trxId, sender } = readPayment(body);
  if (!trxId) throw new OrderError(422, { error: "invalid", fields: { trxId: "Please enter the transaction ID." } });
  if (order.status === "cancelled" || order.payment.verified) throw new OrderError(409, { error: "locked", message: "This order's payment can't be changed any more." });
  const next: Order = {
    ...order,
    payment: { ...order.payment, method: method ?? order.payment.method, trxId, ...(sender ? { sender } : {}), submittedAt: Date.now() },
    seen: false,
    updatedAt: Date.now(),
  };
  await db()`update gr_docs set data = ${db().json(next as never)}, updated_at = now() where kind = 'order' and id = ${order.id}`;
  return next;
}

/** Orders placed from a customer account, or as a guest with the account's phone number, newest first. */
export async function accountOrders(accountId: string, phone: string) {
  const digits = phoneKey(phone).slice(-10);
  const rows = await db()<{ data: Order }[]>`
    select data from gr_docs
    where kind = 'order' and (
      data->>'accountId' = ${accountId}
      or (length(${digits}) = 10 and right(regexp_replace(coalesce(data->'customer'->>'phone', ''), '[^0-9]', '', 'g'), 10) = ${digits})
    )
    order by (data->>'createdAt')::bigint desc limit 100`;
  return rows.map((r) => orderView(r.data));
}

/**
 * The admin panel saves whole order documents. If the customer added payment details after the admin's copy was
 * loaded, keep the customer's newer details instead of overwriting them.
 */
export function mergeOrder(server: Order | undefined, incoming: Order): Order {
  if (!server) return incoming;
  const s = server.payment;
  const i = incoming.payment;
  if ((s?.submittedAt ?? 0) > (i?.submittedAt ?? 0))
    // the admin's copy (and any "payment not found" it carries) is about the details the customer has since replaced
    return {
      ...incoming,
      payment: { ...i, method: s.method, trxId: s.trxId, sender: s.sender, submittedAt: s.submittedAt, rejectedAt: s.rejectedAt },
      seen: incoming.seen && server.seen,
    };
  return incoming;
}

type Tx = postgres.TransactionSql | postgres.Sql;

/**
 * Moves counted stock for an order's items: -1 takes them (an order placed or brought back), +1 puts them back (an
 * order cancelled or deleted). Rows are locked, only stock changes, and products without a count are left alone.
 */
export async function adjustStock(tx: Tx, items: { productId: string; qty: number }[], sign: 1 | -1) {
  const ids = [...new Set(items.map((i) => i.productId))];
  if (!ids.length) return;
  const rows = await tx<{ data: Product }[]>`select data from gr_docs where kind = 'product' and id = any(${ids}) for update`;
  const at = Date.now();
  for (const { data: p } of rows) {
    if (typeof p.stock !== "number") continue;
    const qty = items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0);
    const stock = Math.max(0, p.stock + sign * qty);
    const next: Product = { ...p, stock, stockAt: at, ...(stock === 0 ? { inStock: false } : sign > 0 && p.stock <= 0 ? { inStock: true } : {}), updatedAt: at };
    await tx`update gr_docs set data = ${tx.json(next as never)}, updated_at = now() where kind = 'product' and id = ${p.id}`;
  }
}

/** Orders whose stock is still taken: not cancelled, and not yet out of the door on a deleted order. */
const holdsStock = (o: Order) => o.status !== "cancelled";

/**
 * Stock follows an order's life when the admin panel saves it: cancelling puts the items back, bringing a cancelled
 * order back takes them again, and deleting an order that never left (placed or approved) puts them back.
 */
export async function stockForOrderChange(tx: Tx, before: Order | undefined, after: Order | null) {
  if (!before) return;
  if (after === null) {
    if (holdsStock(before) && (before.status === "placed" || before.status === "confirmed")) await adjustStock(tx, before.items, 1);
    return;
  }
  if (holdsStock(before) && !holdsStock(after)) await adjustStock(tx, before.items, 1);
  else if (!holdsStock(before) && holdsStock(after)) await adjustStock(tx, after.items, -1);
}

/**
 * A coupon follows its order's life too: an order cancelled or deleted before it got a receipt frees its coupon for
 * someone else, and a cancelled order brought back takes it again if it's still free. (Once a receipt uses the
 * coupon, the receipt decides.)
 */
export async function couponForOrderChange(tx: Tx, before: Order | undefined, after: Order | null) {
  if (!before?.coupon) return;
  const gone = after === null || (holdsStock(before) && !holdsStock(after));
  const back = after !== null && !holdsStock(before) && holdsStock(after);
  if (gone) {
    const rows = await tx<{ id: string; data: CouponCode }[]>`select id, data from gr_docs where kind = 'coupon' and data->>'usedOrderId' = ${before.id} for update`;
    for (const { id, data } of rows) {
      if (data.usedInvoiceId) continue;
      const { usedOrderId: _o, usedOrder: _c, ...rest } = data;
      void _o;
      void _c;
      const freed: CouponCode = { ...rest, usedOn: "", updatedAt: Date.now() };
      await tx`update gr_docs set data = ${tx.json(freed as never)}, updated_at = now() where kind = 'coupon' and id = ${id}`;
    }
  } else if (back) {
    const [row] = await tx<{ id: string; data: CouponCode }[]>`
      select id, data from gr_docs where kind = 'coupon' and upper(regexp_replace(data->>'code', '[[:space:]]', '', 'g')) = ${couponKey(before.coupon.code)} for update`;
    if (row && !row.data.usedOn) {
      const used: CouponCode = { ...row.data, usedOn: bdToday(), usedOrderId: before.id, usedOrder: before.code, updatedAt: Date.now() };
      await tx`update gr_docs set data = ${tx.json(used as never)}, updated_at = now() where kind = 'coupon' and id = ${row.id}`;
    }
  }
}

/**
 * A product saved from the admin panel keeps the stock count the server has when that count is newer (a website
 * order took stock after the panel loaded): an edit to the price or photos must not bring old stock back.
 */
export function mergeProduct(server: Product | undefined, incoming: Product): Product {
  if (!server || typeof server.stock !== "number") return incoming;
  if ((server.stockAt ?? 0) <= (incoming.stockAt ?? 0)) return incoming;
  return { ...incoming, stock: server.stock, stockAt: server.stockAt, ...(server.stock <= 0 ? { inStock: false } : {}) };
}

/** The receipt the shop made for an approved order, with the shop details it prints (null until approved). */
export async function orderReceipt(order: Order) {
  if (!order.payment.verified || !order.invoiceId) return null;
  const [inv] = await db()<{ data: Invoice }[]>`select data from gr_docs where kind = 'invoice' and id = ${order.invoiceId}`;
  if (!inv) return null;
  const shop = await loadShop();
  const { name, tagline, address, phone, email, website, logo, thankYou, terms, watermark } = shop;
  return { invoice: inv.data, shop: { name, tagline, address, phone, email, website, logo, thankYou, terms, watermark } };
}

export const newId = () => randomUUID();
