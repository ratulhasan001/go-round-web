import { payState, tk } from "./site";
import type { Order, OrderMessageKey } from "./types";

/** Every situation the shop can message a customer about, in the order an order goes through them. */
export const ORDER_MESSAGES: { key: OrderMessageKey; label: string; hint: string }[] = [
  { key: "received", label: "Order received", hint: "New order, no payment sent yet" },
  { key: "checking", label: "Checking payment", hint: "The customer sent a transaction ID" },
  { key: "notFound", label: "Payment not found", hint: "After Payment not found" },
  { key: "approved", label: "Order approved", hint: "After Approve payment" },
  { key: "shipped", label: "Shipped", hint: "After Mark as shipped" },
  { key: "delivered", label: "Delivered", hint: "After Mark as delivered" },
  { key: "cancelled", label: "Cancelled", hint: "After Cancel order" },
];

/** The words each message can include; they are filled in from the order when the message is sent. */
export const MESSAGE_FIELDS: { tag: string; what: string }[] = [
  { tag: "{name}", what: "customer's first name" },
  { tag: "{shop}", what: "shop name" },
  { tag: "{code}", what: "order number" },
  { tag: "{items}", what: "the products, one per line" },
  { tag: "{total}", what: "order total" },
  { tag: "{coupon}", what: "coupon line (if used)" },
  { tag: "{trxid}", what: "transaction ID the customer sent" },
  { tag: "{payment}", what: "how to pay (bKash number or bank details)" },
  { tag: "{receipt}", what: "receipt number" },
  { tag: "{tracking}", what: "courier / tracking from the order" },
  { tag: "{link}", what: "order status link (opens their order directly)" },
];

const BODY = `{items}\n{coupon}`;

export const DEFAULT_MESSAGES: Record<OrderMessageKey, string> = {
  received: `Hello {name},\nThank you for your order *{code}* from {shop}!\n\n${BODY}\nTotal: *{total}*\n\n{payment}\n\nSee your order: {link}`,
  checking: `Hello {name},\nWe've received your order *{code}* and your payment (transaction ID {trxid}). We're checking it now and will update you shortly.\n\n${BODY}\nTotal: *{total}*\n\nSee your order: {link}`,
  notFound: `Hello {name},\nWe couldn't find the payment for your order *{code}* (transaction ID {trxid}). Please check it and send it again on your order page.\n\n{payment}\n\nYour order: {link}`,
  approved: `Hello {name},\nGood news! Your order *{code}* is approved - your payment of *{total}* is received and we're packing your order now.\n\n${BODY}\n\nReceipt: {receipt}\nSee your order and download the receipt: {link}`,
  shipped: `Hello {name},\nYour order *{code}* has been shipped and is on its way!\n\nCourier / tracking: {tracking}\n\nFollow your order: {link}`,
  delivered: `Hello {name},\nYour order *{code}* has been delivered. Thank you for shopping with {shop}!\n\nWe'd love to hear how you like it - you can leave a review on our website.\n\nYour order and receipt: {link}`,
  cancelled: `Hello {name},\nYour order *{code}* from {shop} has been cancelled. If you have any questions, just reply to this message.`,
};

/** The shop's wording for a message, or the default when it hasn't written its own. */
export const messageTemplate = (own: Partial<Record<OrderMessageKey, string>> | undefined, key: OrderMessageKey) =>
  own?.[key]?.trim() ? own[key]! : DEFAULT_MESSAGES[key];

/** The message that fits where the order is now. */
export function messageKeyFor(o: Order): OrderMessageKey {
  if (o.status === "placed") {
    const pay = payState(o);
    if (pay === "verified") return "approved";
    if (pay === "rejected") return "notFound";
    return pay === "submitted" ? "checking" : "received";
  }
  return o.status === "confirmed" ? "approved" : o.status;
}

/**
 * Fills a message's {fields} from the order. A line whose fields are all empty (no coupon, no tracking yet…) is left out,
 * and runs of blank lines close up.
 */
export function fillMessage(template: string, o: Order, values: { shop: string; payment: string; link: string }) {
  const v: Record<string, string> = {
    name: o.customer.name.trim().split(/\s+/)[0] || "there",
    shop: values.shop,
    code: o.code,
    items: o.items.map((i) => `• ${i.qty} × ${i.name}`).join("\n"),
    total: tk(o.total),
    coupon: o.coupon?.amount ? `Coupon ${o.coupon.code}: −${tk(o.coupon.amount)}` : "",
    trxid: o.payment.trxId?.trim() ?? "",
    payment: values.payment,
    receipt: o.invoiceNumber ?? "",
    tracking: o.tracking?.trim() ?? "",
    link: values.link,
    phone: o.customer.phone,
  };
  const lines = template.split("\n").flatMap((line) => {
    const tags = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!.toLowerCase()).filter((t) => t in v);
    if (tags.length && tags.every((t) => !v[t])) return [];
    return [line.replace(/\{(\w+)\}/g, (m, t: string) => (t.toLowerCase() in v ? v[t.toLowerCase()]! : m))];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
