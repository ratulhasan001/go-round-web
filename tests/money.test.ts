// The shop's money rules, checked with numbers worked out by hand: receipt totals, coupons, delivery charges,
// discounted prices, and what the website may see of a product. A change that alters any of these fails here first.
import { describe, expect, it } from "vitest";
import { amountInWords, computeTotals, lineAmount } from "@/lib/calc";
import { bdToday, couponAmount, couponKey, couponLabel, websiteCouponProblem } from "@/lib/couponRules";
import { isDiscounted, regularOf, withRegular, withUnitPrice } from "@/lib/productPrice";
import { cardProduct, DEFAULT_ZONES, deliveryFee, extraKg, listedProduct, publicProduct, siteSettings } from "@/lib/site";
import { mergeOrder, mergeProduct } from "@/lib/server/orders";
import type { CouponCode, Invoice, Order, Product, Shop } from "@/lib/types";

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  number: "GR-0001",
  date: "2026-11-21",
  customer: { name: "Rahim", phone: "01712345678", address: "Dhaka" },
  items: [
    { id: "a", description: "Anubias nana", qty: 2, price: 450 },
    { id: "b", description: "Seachem Prime", qty: 1, price: 1200.5 },
  ],
  delivery: 110,
  discount: 0,
  payments: [],
  notes: "",
  createdAt: 0,
  updatedAt: 0,
  ...over,
} as Invoice);

describe("receipt totals (computeTotals)", () => {
  it("adds the items and the delivery", () => {
    const t = computeTotals(invoice());
    expect(t.subtotal).toBe(2100.5); // 2 × 450 + 1200.50
    expect(t.grandTotal).toBe(2210.5); // + 110 delivery
    expect(t.due).toBe(2210.5);
    expect(t.status).toBe("UNPAID");
  });

  it("counts a priced row without a name, but not an empty one", () => {
    const t = computeTotals(invoice({ items: [{ id: "a", description: "", qty: 3, price: 10 } as never, { id: "b", description: "", qty: 1, price: 0 } as never] }));
    expect(t.subtotal).toBe(30);
  });

  it("takes a % discount and a fixed discount off the items only", () => {
    const t = computeTotals(invoice({ discountPct: 10, discount: 50 }));
    expect(t.discountTotal).toBe(260.05); // 10% of 2100.50 = 210.05, + 50
    expect(t.grandTotal).toBe(1950.45); // 2100.50 + 110 - 260.05
  });

  it("never discounts more than the items cost", () => {
    const t = computeTotals(invoice({ discount: 99999 }));
    expect(t.discountTotal).toBe(2100.5);
    expect(t.grandTotal).toBe(110); // the delivery is still charged
  });

  it("waives the delivery once, whether by discount or by coupon", () => {
    const both = computeTotals(invoice({ discountFreeDelivery: true, coupon: { code: "gr1", pct: 0, freeDelivery: true } as never }));
    expect(both.discountTotal).toBe(110);
    expect(both.couponTotal).toBe(0); // not a second time
    expect(both.grandTotal).toBe(2100.5);
  });

  it("applies a coupon to what is left after the discount", () => {
    const t = computeTotals(invoice({ discount: 100.5, coupon: { code: "gr5", pct: 5 } as never }));
    expect(t.couponTotal).toBe(100); // 5% of (2100.50 - 100.50)
    expect(t.grandTotal).toBe(2010); // 2100.50 + 110 - 100.50 - 100
    expect(t.couponLabel).toBe("Coupon GR5 (5%)");
  });

  it("ignores a gift coupon and an invalid one", () => {
    expect(computeTotals(invoice({ coupon: { code: "g", pct: 50, gift: true } as never })).couponTotal).toBe(0);
    expect(computeTotals(invoice({ coupon: { code: "x", pct: 50, invalid: true } as never })).couponTotal).toBe(0);
  });

  it("tracks payments: partial, then paid", () => {
    const partial = computeTotals(invoice({ payments: [{ id: "p", date: "2026-11-20", amount: 1000, method: "bKash" } as never] }));
    expect(partial.status).toBe("PARTIAL");
    expect(partial.due).toBe(1210.5);
    const paid = computeTotals(invoice({ payments: [{ id: "p", date: "2026-11-20", amount: 1000 } as never, { id: "q", date: "2026-11-21", amount: 1210.5 } as never] }));
    expect(paid.status).toBe("PAID");
    expect(paid.due).toBe(0);
    expect(paid.lastPayment).toBe("2026-11-21");
  });

  it("adds a payment-channel charge on the items only", () => {
    const t = computeTotals(invoice({ extras: { enabled: true, payVia: "bKash", payRate: 2, courier: "None", courierRate: 0, manual: [] } as never }));
    expect(t.chargesTotal).toBe(42.01); // 2% of 2100.50
    expect(t.grandTotal).toBe(2252.51);
  });

  it("rounds line amounts to paisa", () => {
    expect(lineAmount({ id: "x", description: "x", qty: 3, price: 33.333 } as never)).toBe(100);
  });
});

describe("amount in words", () => {
  it("writes taka in words, with paisa", () => {
    expect(amountInWords(2210.5)).toBe("Taka Two Thousand Two Hundred Ten and Fifty Paisa Only");
    expect(amountInWords(150000)).toBe("Taka One Lakh Fifty Thousand Only");
  });
});

describe("coupons on website orders", () => {
  const coupon = (over: Partial<CouponCode> = {}): CouponCode => ({ id: "c", code: "GR41-8744", name: "", phone: "01712345678", pct: 10, validFrom: "2026-11-01", validTo: "2026-12-31", ...over } as CouponCode);
  const rahim = { phone: "+8801712345678", name: "Rahim" };

  it("takes its % of the items, plus the delivery when it gives free delivery", () => {
    expect(couponAmount(1000, 110, { pct: 10 })).toBe(100);
    expect(couponAmount(1000, 110, { pct: 0, freeDelivery: true })).toBe(110);
    expect(couponAmount(1000, 110, { pct: 5, freeDelivery: true })).toBe(160);
    expect(couponAmount(1000, 0, { pct: 0, freeDelivery: true })).toBe(0); // nothing to waive
    expect(couponAmount(100, 0, { pct: 150 })).toBe(100); // never more than the items
  });

  it("compares codes without spaces and case", () => {
    expect(couponKey(" gr41-87 44 ")).toBe("GR41-8744");
    expect(couponLabel({ pct: 5, freeDelivery: true })).toBe("5% off + free delivery");
  });

  it("uses Bangladesh dates, not the server's", () => {
    expect(bdToday(Date.UTC(2026, 10, 21, 17, 59))).toBe("2026-11-21"); // 23:59 in Dhaka
    expect(bdToday(Date.UTC(2026, 10, 21, 18, 0))).toBe("2026-11-22"); // midnight in Dhaka
  });

  it("is accepted for its owner within its dates (the number in any format)", () => {
    expect(websiteCouponProblem(coupon(), rahim, "2026-11-21")).toBe("");
  });

  it("is refused when used, expired, not yet valid, or someone else's", () => {
    expect(websiteCouponProblem(undefined, rahim, "2026-11-21")).toMatch(/isn't valid/);
    expect(websiteCouponProblem(coupon({ usedOn: "2026-11-02" }), rahim, "2026-11-21")).toMatch(/already been used/);
    expect(websiteCouponProblem(coupon(), rahim, "2027-01-01")).toMatch(/expired/);
    expect(websiteCouponProblem(coupon(), rahim, "2026-10-31")).toMatch(/can be used from 01-11-2026/);
    expect(websiteCouponProblem(coupon(), { phone: "01811111111", name: "Rahim" }, "2026-11-21")).toMatch(/another customer/);
    expect(websiteCouponProblem(coupon({ pct: 0 }), rahim, "2026-11-21")).toMatch(/isn't valid/);
  });

  it("goes by name when it was given without a number", () => {
    const named = coupon({ phone: "", name: "Karim  Uddin" });
    expect(websiteCouponProblem(named, { phone: "01700000000", name: "karim uddin" }, "2026-11-21")).toBe("");
    expect(websiteCouponProblem(named, { phone: "01700000000", name: "Rahim" }, "2026-11-21")).toMatch(/another customer/);
  });
});

describe("delivery charges", () => {
  const settings = siteSettings({ site: {} } as Shop);

  it("charges a started kg over the first one", () => {
    expect(extraKg(0)).toBe(0);
    expect(extraKg(1)).toBe(0);
    expect(extraKg(1.001)).toBe(1);
    expect(extraKg(2.5)).toBe(2);
  });

  it("adds the per-kg charge to the service's fee", () => {
    const express = DEFAULT_ZONES.find((z) => z.id === "sf-in-express")!;
    expect(deliveryFee(settings, "sf-in-express", 1000, 2.5).fee).toBe(express.fee + 2 * express.perKg!); // 110 + 2 × 25
  });

  it("charges nothing up front for a service quoted after the order", () => {
    const r = deliveryFee(settings, "pa-in-instant", 1000, 3);
    expect(r.fee).toBe(0);
    expect(r.quote).toBe(true);
  });

  it("is free over the shop's free-delivery amount", () => {
    const free = siteSettings({ site: { freeDeliveryOver: 3000 } } as Shop);
    expect(deliveryFee(free, "sf-in-express", 3000, 5).fee).toBe(0);
    expect(deliveryFee(free, "sf-in-express", 2999, 0).fee).toBe(110);
  });

  it("falls back to the first service for an unknown one", () => {
    expect(deliveryFee(settings, "nope", 100).zoneId).toBe(DEFAULT_ZONES[0]!.id);
  });
});

describe("discounted prices", () => {
  it("knows the regular price only when it is higher", () => {
    expect(isDiscounted({ price: 549, regularPrice: 650 })).toBe(true);
    expect(isDiscounted({ price: 549, regularPrice: 549 })).toBe(false);
    expect(regularOf({ price: 549, regularPrice: 650 })).toBe(650);
    expect(regularOf({ price: 549 })).toBe(549);
  });

  it("edits keep the discount when they make sense", () => {
    expect(withRegular({ price: 549, regularPrice: 650 }, 700)).toEqual({ regularPrice: 700 });
    expect(withUnitPrice({ price: 549, regularPrice: 650 }, 500)).toEqual({ price: 500 });
  });
});

describe("what the website sees of a product", () => {
  const product = { id: "p1", name: " Java fern ", price: 299, regularPrice: 350, purchasePrice: 120, purchasePriceMax: 140, stock: 0, onSite: true, description: "<p>Easy <b>plant</b></p>", specification: "Size: 5 cm", sku: "JF-1", images: ["https://img.goroundbd.com/p/abc"], category: "Plants", weight: 0.3 } as unknown as Product;

  it("never includes the shop's purchase price", () => {
    for (const shape of [publicProduct(product), cardProduct(publicProduct(product)), listedProduct(publicProduct(product))]) {
      expect(JSON.stringify(shape)).not.toMatch(/purchase|120|140/);
    }
  });

  it("sells out a product whose counted stock is 0", () => {
    expect(publicProduct(product).inStock).toBe(false);
    expect(publicProduct({ ...product, stock: 3 } as Product).inStock).toBe(true);
  });

  it("sends the shop's list the description as plain text, and no specification", () => {
    const listed = listedProduct(publicProduct(product));
    expect(listed.text).toBe("Easy plant");
    expect(listed).not.toHaveProperty("specification");
    expect(listed).not.toHaveProperty("description");
    expect(cardProduct(publicProduct(product))).not.toHaveProperty("sku");
  });
});

describe("saving from the admin panel", () => {
  it("keeps payment details the customer added after the panel loaded the order", () => {
    const server = { id: "o", payment: { method: "bKash", trxId: "NEW123", submittedAt: 200 }, seen: false } as unknown as Order;
    const panel = { id: "o", status: "confirmed", payment: { method: "bKash", trxId: "OLD", submittedAt: 100 }, seen: true } as unknown as Order;
    const merged = mergeOrder(server, panel);
    expect(merged.payment.trxId).toBe("NEW123");
    expect(merged.status).toBe("confirmed"); // the admin's own change stays
    expect(merged.seen).toBe(false); // the new payment still needs a look
  });

  it("keeps the newer stock count when a website order took stock after the panel loaded", () => {
    const server = { id: "p", stock: 2, stockAt: 200 } as Product;
    const panel = { id: "p", stock: 5, stockAt: 100, price: 999 } as Product;
    expect(mergeProduct(server, panel)).toMatchObject({ stock: 2, stockAt: 200, price: 999 });
    expect(mergeProduct({ id: "p", stock: 0, stockAt: 300 } as Product, panel).inStock).toBe(false);
    expect(mergeProduct(server, { ...panel, stockAt: 300 } as Product).stock).toBe(5); // the panel's count is newer
  });
});
