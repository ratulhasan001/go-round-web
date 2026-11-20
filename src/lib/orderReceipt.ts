import { todayISO, uid } from "./calc";
import type { Invoice, Order, Payment } from "./types";

/** The approved website payment, as a receipt payment (an advance: it was paid before delivery). */
export const orderPayment = (order: Order): Payment => ({
  id: uid(),
  date: todayISO(),
  method: order.payment.method,
  amount: order.total,
  note: order.payment.trxId ? `TrxID ${order.payment.trxId}` : "",
  advance: true,
  fromOrder: order.id,
});

/** Is this receipt payment the one approving `order` added? (Older ones carry no order id: same amount and TrxID note.) */
export const isOrderPayment = (p: Payment, order: Order) =>
  p.fromOrder ? p.fromOrder === order.id : !!p.advance && p.amount === order.total && p.note === (order.payment.trxId ? `TrxID ${order.payment.trxId}` : "");

/**
 * A receipt for a website order: its customer, items and delivery, plus the payment once the shop has approved it
 * (recorded as an advance, since it was paid before delivery).
 */
export function invoiceFromOrder(order: Order, number: string): Invoice {
  const now = Date.now();
  return {
    id: uid(),
    number,
    date: todayISO(),
    customer: { name: order.customer.name, phone: order.customer.phone, address: order.customer.address },
    items: order.items.map((i) => ({ id: uid(), description: i.name, price: i.price, qty: i.qty })),
    delivery: order.delivery,
    discount: 0,
    // the coupon used at checkout, so the receipt takes off what the order did (and the coupon follows the receipt)
    ...(order.coupon ? { coupon: { code: order.coupon.code, pct: order.coupon.pct, amount: 0, freeDelivery: order.coupon.freeDelivery } } : {}),
    payments: order.payment.verified ? [orderPayment(order)] : [],
    notes: `Website order ${order.code}`,
    orderId: order.id,
    createdAt: now,
    updatedAt: now,
  };
}
