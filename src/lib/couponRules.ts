import type { CouponCode } from "./types";
import { phoneKey } from "./phone";

// Coupons on website orders. Shared by the checkout (to show the discount), the server (which checks the coupon again
// and takes it when the order is placed) and the admin panel - so the discount is the same everywhere, and the same
// as the receipt the order becomes (see computeTotals in calc.ts).

/** A coupon as a website order keeps it: its offer and what it took off the order. */
export interface OrderCoupon {
  code: string;
  pct: number; // % off the items
  freeDelivery: boolean;
  amount: number; // BDT taken off the order
}

/** A coupon code the way codes are compared: no spaces, capital letters ("gr41-87 44-79a" → "GR41-8744-79A"). */
export const couponKey = (code: string) => code.replace(/\s+/g, "").toUpperCase();

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a coupon takes off: its percentage of the items, plus the delivery charge when it is a free-delivery coupon. */
export function couponAmount(subtotal: number, delivery: number, offer: { pct: number; freeDelivery?: boolean }) {
  const items = Math.min(subtotal, (subtotal * (Number(offer.pct) || 0)) / 100);
  return round2(items + (offer.freeDelivery && delivery > 0 ? delivery : 0));
}

/** "5% off", "Free delivery", "5% off + free delivery" */
export const couponLabel = (o: { pct: number; freeDelivery?: boolean }) =>
  [o.pct ? `${o.pct}% off` : "", o.freeDelivery ? (o.pct ? "free delivery" : "Free delivery") : ""].filter(Boolean).join(" + ");

/** Today's date in Bangladesh (yyyy-mm-dd) - coupon dates are Bangladesh dates, the server's clock is not. */
export const bdToday = (now = Date.now()) => new Date(now + 6 * 3600_000).toISOString().slice(0, 10);

/**
 * Why a customer can't use this coupon on a website order ("" when they can). A coupon given to someone is theirs
 * alone: it needs the mobile number it was given with (or, without one, the same name). The reasons never say who
 * the coupon belongs to.
 */
export function websiteCouponProblem(c: CouponCode | undefined, customer: { phone: string; name: string }, today = bdToday()): string {
  if (!c) return "That coupon code isn't valid. Please check it and try again.";
  if (c.usedOn) return "This coupon has already been used.";
  if (c.validTo && c.validTo < today) return "This coupon has expired.";
  if (c.validFrom && c.validFrom > today) return `This coupon can be used from ${c.validFrom.split("-").reverse().join("-")}.`;
  if (!(Number(c.pct) > 0) && !c.freeDelivery) return "That coupon code isn't valid. Please check it and try again.";
  const owner = phoneKey(c.phone).slice(-10);
  if (owner) {
    const mine = phoneKey(customer.phone).slice(-10);
    if (!mine) return "Please type your mobile number first - the coupon is checked against it.";
    if (owner !== mine) return "This coupon was given to another customer, so it can't be used with this mobile number.";
  } else if (c.name.trim()) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    if (!customer.name.trim()) return "Please type your name first - the coupon is checked against it.";
    if (norm(c.name) !== norm(customer.name)) return "This coupon was given to another customer, so it can't be used with this name.";
  }
  return "";
}
