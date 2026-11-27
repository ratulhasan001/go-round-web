"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  FileText,
  ImageOff,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { invoiceFromOrder, isOrderPayment, orderPayment } from "@/lib/orderReceipt";
import { computeTotals } from "@/lib/calc";
import { ORDER_HINT, ORDER_LABEL, ORDER_STEPS, PROGRESS_LABEL, PROGRESS_STEPS, fmtWhen, progressIndex, payState, thumb, tk, waLink } from "@/lib/site";
import type { Order, OrderMessageKey, OrderStatus } from "@/lib/types";
import { ORDER_MESSAGES, messageKeyFor } from "@/lib/orderMessages";
import { Modal } from "../Modal";
import { Button, Input, Label, Select, Textarea, cx, useToast } from "../ui";
import { PayChip, StatusChip, updateMessage } from "./shared";
import { couponAmount, couponLabel } from "@/lib/couponRules";

// "placed" moves on through Approve payment (see Body), which also makes the customer's receipt
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: React.ReactNode }>> = {
  confirmed: { to: "shipped", label: "Mark as shipped", icon: <Truck className="size-4" /> },
  shipped: { to: "delivered", label: "Mark as delivered", icon: <PackageCheck className="size-4" /> },
};

const withStatus = (o: Order, status: OrderStatus): Order => ({ ...o, status, history: [...o.history, { status, at: Date.now() }] });

/** Everything about one website order, with the next step one tap away. */
export function OrderPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { orders, saveOrder, shop } = useStore();
  const order = id ? orders.find((o) => o.id === id) : undefined;
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      variant="side"
      icon={<ShoppingBag className="size-5" />}
      title={order ? `Order ${order.code}` : ""}
      subtitle={order ? `Placed ${fmtWhen(order.createdAt)}` : undefined}
      footer={order ? <Footer order={order} /> : undefined}
    >
      {order ? <Body key={order.id} order={order} save={saveOrder} shopName={shop.name} /> : null}
    </Modal>
  );
}

function Footer({ order }: { order: Order }) {
  const { shop } = useStore();
  const router = useRouter();
  // the message that fits the order now, unless the admin picks another one (a new status picks again)
  const auto = messageKeyFor(order);
  const [picked, setPicked] = useState<{ key: OrderMessageKey; for: string } | null>(null);
  const key = picked && picked.for === `${order.id}:${auto}` ? picked.key : auto;
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex w-full items-center gap-2">
        <label htmlFor="wa-message" className="shrink-0 text-[12px] font-semibold text-muted">Message</label>
        <Select id="wa-message" className="h-9 flex-1 text-[13px]" value={key} onChange={(e) => setPicked({ key: e.target.value as OrderMessageKey, for: `${order.id}:${auto}` })}>
          {ORDER_MESSAGES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
              {m.key === auto ? " (now)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <a
        href={waLink(order.customer.phone, updateMessage(order, shop, key))}
        target="_blank"
        rel="noopener"
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:brightness-95 active:scale-[0.98]"
      >
        <MessageCircle className="size-4" /> Send on WhatsApp
      </a>
      {order.invoiceId ? (
        <Button variant="dark" className="flex-1" onClick={() => router.push(`/new?id=${order.invoiceId}`)}>
          <FileText className="size-4" /> Open receipt {order.invoiceNumber}
        </Button>
      ) : (
        <Button variant="dark" className="flex-1" onClick={() => router.push(`/new?order=${order.id}`)}>
          <FileText className="size-4" /> Make receipt
        </Button>
      )}
    </div>
  );
}

function Body({ order: o, save, shopName }: { order: Order; save: (o: Order) => void; shopName: string }) {
  const toast = useToast();
  const { saveInvoice, nextInvoiceNumber, invoices, orders } = useStore();
  const linked = o.invoiceId ? invoices.find((i) => i.id === o.invoiceId) : undefined;

  /** The payment has reached us: approve it, move the order on, and make the receipt the customer downloads. */
  const approve = () => {
    let next: Order = { ...o, payment: { ...o.payment, verified: true, verifiedAt: Date.now(), rejectedAt: undefined } };
    if (next.status === "placed") next = withStatus(next, "confirmed");
    save(next);
    if (linked) {
      // a receipt made by hand before approving: record the payment on it (unless it already shows the order paid)
      if (!linked.payments.some((p) => isOrderPayment(p, next)) && computeTotals(linked).due > 0) saveInvoice({ ...linked, payments: [...linked.payments, orderPayment(next)] }, { remember: false });
      return toast(`${o.code} approved · receipt ${linked.number} is on their order page`);
    }
    const inv = saveInvoice(invoiceFromOrder(next, nextInvoiceNumber()));
    toast(`${o.code} approved · receipt ${inv.number} is ready for the customer`);
  };
  const reject = () => {
    save({ ...o, payment: { ...o.payment, rejectedAt: Date.now() } });
    toast("Marked as not found - send the customer an update so they can resend it");
  };
  /** Undo an approval: the order goes back to waiting, and the payment approving added to its receipt comes off. */
  const unapprove = () => {
    let next: Order = { ...o, payment: { ...o.payment, verified: false, verifiedAt: undefined } };
    if (next.status === "confirmed") next = withStatus(next, "placed");
    save(next);
    if (linked && linked.payments.some((p) => isOrderPayment(p, o))) saveInvoice({ ...linked, payments: linked.payments.filter((p) => !isOrderPayment(p, o)) }, { remember: false });
    toast(`${o.code}: approval undone`);
  };
  /** Sets the delivery charge on a "charge by location" order, and on its receipt. */
  const [charge, setCharge] = useState("");
  const setDelivery = () => {
    const fee = Math.max(0, Math.round(Number(charge) * 100) / 100);
    if (!charge.trim() || !Number.isFinite(fee)) return toast("Type the delivery charge", "err");
    // a coupon keeps what it takes off (a free-delivery coupon now covers the charge too)
    const coupon = o.coupon ? { ...o.coupon, amount: couponAmount(o.subtotal, fee, o.coupon) } : undefined;
    save({ ...o, delivery: fee, ...(coupon ? { coupon } : {}), total: Math.round((o.subtotal + fee - (coupon?.amount ?? 0)) * 100) / 100, deliveryQuote: false });
    if (linked) saveInvoice({ ...linked, delivery: fee }, { remember: false });
    setCharge("");
    toast(`Delivery charge ${tk(fee)} added - send the customer an update`);
  };
  // the same transaction id on another live order: one payment can't pay for two orders
  const trxKey = (t?: string) => (t ?? "").toUpperCase().replace(/[\s-]/g, "");
  const sameTrx = o.payment.trxId ? orders.filter((x) => x.id !== o.id && x.status !== "cancelled" && trxKey(x.payment.trxId) === trxKey(o.payment.trxId)) : [];
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(cancelTimer.current), []);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Could not copy - your browser blocked the clipboard", "err");
    }
  };

  const next = NEXT[o.status];
  const step = ORDER_STEPS.indexOf(o.status);
  const back = step > 0 ? ORDER_STEPS[step - 1] : null;
  // where a cancelled order goes back to: the last step it reached
  const restoreTo = [...o.history].reverse().find((h) => h.status !== "cancelled")?.status ?? "placed";
  const pay = payState(o);

  const cancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      clearTimeout(cancelTimer.current);
      cancelTimer.current = setTimeout(() => setConfirmCancel(false), 3000);
      return;
    }
    setConfirmCancel(false);
    save(withStatus(o, "cancelled"));
    toast(`Order ${o.code} cancelled`);
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* status */}
      <section className="rounded-2xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusChip status={o.status} />
            <PayChip order={o} />
          </div>
          <span className="text-[12px] text-muted">Updated {fmtWhen(o.updatedAt)}</span>
        </div>
        <p className="mt-2 text-[13px] text-muted">{ORDER_HINT[o.status]}</p>

        {o.status !== "cancelled" && (
          <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Progress">
            {PROGRESS_STEPS.map((s, i) => (
              <li key={s} className="flex flex-col gap-1.5">
                <span className={cx("h-1.5 rounded-full transition-colors duration-500", i <= progressIndex(o) ? "bg-brand" : "bg-line")} />
                <span className={cx("text-[11px] font-semibold leading-tight", i <= progressIndex(o) ? "text-ink" : "text-faint")}>{PROGRESS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        )}

        {(o.status === "confirmed" || o.status === "shipped" || o.status === "delivered") && (
          <div className="mt-4">
            <Label htmlFor="tracking">Courier / tracking (customer sees this)</Label>
            <Input
              id="tracking"
              placeholder="e.g. Steadfast · consignment 123456"
              value={o.tracking ?? ""}
              onChange={(e) => save({ ...o, tracking: e.target.value })}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {o.status === "placed" && (
            <Button variant="primary" size="lg" className="flex-1" onClick={approve}>
              <CheckCircle2 className="size-4" /> {pay === "awaiting" ? "Approve (payment received)" : "Approve payment"}
            </Button>
          )}
          {next && (
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => {
                save(withStatus(o, next.to));
                toast(`${o.code}: ${ORDER_LABEL[next.to]}`);
              }}
            >
              {next.icon} {next.label}
            </Button>
          )}
          {o.status === "cancelled" && (
            <Button variant="primary" size="lg" className="flex-1" onClick={() => save(withStatus(o, restoreTo))}>
              <RotateCcw className="size-4" /> Restore order ({ORDER_LABEL[restoreTo]})
            </Button>
          )}
        </div>
        {o.status === "placed" && (
          <p className="mt-2 text-[12px] text-muted">
            Check that {tk(o.total)} reached your {o.payment.method === "bKash" ? "bKash" : "bank account"} first. Approving makes the receipt, and the customer can download it from the website.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {back && o.status !== "cancelled" && (
            <Button variant="ghost" size="sm" onClick={() => save(withStatus(o, back))}>
              <ArrowLeft className="size-3.5" /> Back to {ORDER_LABEL[back].toLowerCase()}
            </Button>
          )}
          {o.status !== "cancelled" && o.status !== "delivered" && (
            <Button variant="ghost" size="sm" className={cx("ml-auto", confirmCancel ? "bg-red-50 text-red-700" : "text-red-600")} onClick={cancel}>
              <Ban className="size-3.5" /> {confirmCancel ? "Tap again to cancel" : "Cancel order"}
            </Button>
          )}
        </div>
      </section>

      {/* payment */}
      <section className={cx("rounded-2xl border p-4", pay === "submitted" ? "border-amber-300 bg-amber-50/40" : pay === "rejected" ? "border-red-200" : "border-line")}>
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <Wallet className="size-4 text-brand" /> Payment · {o.payment.method}
        </h3>
        {o.payment.trxId ? (
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[13.5px]">
            <dt className="text-muted">{o.payment.method === "bKash" ? "TrxID" : "Reference"}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono font-bold tracking-wide">{o.payment.trxId}</span>
              <button type="button" onClick={() => copy(o.payment.trxId!, "Transaction ID")} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Copy transaction ID">
                <Copy className="size-3.5" />
              </button>
            </dd>
            {o.payment.sender && (
              <>
                <dt className="text-muted">From</dt>
                <dd className="font-semibold">{o.payment.sender}</dd>
              </>
            )}
            {o.payment.submittedAt && (
              <>
                <dt className="text-muted">Sent</dt>
                <dd>{fmtWhen(o.payment.submittedAt)}</dd>
              </>
            )}
            <dt className="text-muted">Amount due</dt>
            <dd className="font-amount">{tk(o.total)}</dd>
          </dl>
        ) : (
          <p className="text-[13px] text-muted">The customer hasn&apos;t sent payment details yet. They can add them from the Order status page, or you can ask on WhatsApp.</p>
        )}
        {sameTrx.length > 0 && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">
            This transaction ID is also on order{sameTrx.length > 1 ? "s" : ""} {sameTrx.map((x) => x.code).join(", ")}. One payment can&apos;t pay for two orders - check before approving.
          </p>
        )}
        {o.payment.verified ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-lime/15 px-3 py-2.5">
            <span>
              <span className="flex items-center gap-1.5 text-[14px] font-bold text-brand">
                <CheckCircle2 className="size-4" /> Payment approved
              </span>
              <span className="block text-[12px] text-muted">
                {o.payment.verifiedAt ? fmtWhen(o.payment.verifiedAt) : ""}
                {o.invoiceNumber ? ` · receipt ${o.invoiceNumber} is on the customer's order page` : " · make the receipt so the customer can download it"}
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={unapprove}>
              Undo
            </Button>
          </div>
        ) : o.status !== "cancelled" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {/* a new order has the big Approve button at the top; an older one that moved on unpaid gets it here */}
            {o.status !== "placed" && (
              <Button variant="primary" className="flex-1" onClick={approve}>
                <CheckCircle2 className="size-4" /> Approve payment
              </Button>
            )}
            {o.payment.trxId && pay !== "rejected" && (
              <Button variant="danger" className="flex-1" onClick={reject}>
                <Ban className="size-4" /> Payment not found
              </Button>
            )}
            {pay === "rejected" && <p className="w-full text-[12px] text-red-700">Marked as not found. The customer is asked to check and resend it on their order page.</p>}
          </div>
        ) : null}
      </section>

      {/* customer */}
      <section className="rounded-2xl border border-line p-4">
        <h3 className="text-[15px] font-bold">{o.customer.name}</h3>
        <p className="text-[13.5px] text-body">{o.customer.phone}{o.customer.email ? ` · ${o.customer.email}` : ""}</p>
        <p className="mt-2 flex gap-2 whitespace-pre-line text-[13.5px] text-body">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
          {o.customer.address}
        </p>
        <p className="mt-1 text-[12px] text-muted">{o.accountId ? "Ordered from a customer account" : "Guest checkout"}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={`tel:${o.customer.phone.replace(/[^\d+]/g, "")}`} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] font-semibold hover:bg-canvas">
            <Phone className="size-4" /> Call
          </a>
          <a href={waLink(o.customer.phone)} target="_blank" rel="noopener" className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] font-semibold text-[#128C7E] hover:bg-canvas">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <button
            type="button"
            onClick={() => copy(`Name: ${o.customer.name}\nPhone: ${o.customer.phone}\nAddress: ${o.customer.address}`, "Name, phone and address")}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] font-semibold hover:bg-canvas"
          >
            <Copy className="size-4" /> Address
          </button>
        </div>
        {o.note && (
          <div className="mt-3 rounded-xl bg-aqua-soft px-3 py-2 text-[13px] text-aqua-deep">
            <b>Customer note:</b> {o.note}
          </div>
        )}
      </section>

      {/* items */}
      <section className="rounded-2xl border border-line p-4">
        <h3 className="mb-3 text-[15px] font-bold">Items</h3>
        <ul className="flex flex-col gap-3">
          {o.items.map((it) => (
            <li key={`${it.productId}~${it.variantId ?? ""}`} className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded product photo
                  <img src={thumb(it.image)} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <ImageOff className="size-4 text-faint" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{it.name}</p>
                <p className="text-[12.5px] text-muted">
                  {it.qty} × {tk(it.price)}
                  {it.unit ? ` / ${it.unit}` : ""}
                </p>
              </div>
              <span className="font-amount text-[14px]">{tk(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-[13.5px]">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-amount">{tk(o.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery · {o.zone}</dt>
            <dd className="font-amount">{o.deliveryQuote ? "By location - tell the customer" : o.delivery ? tk(o.delivery) : "Free"}</dd>
          </div>
          {o.coupon && (
            <div className="flex justify-between gap-3 text-brand">
              <dt>
                Coupon {o.coupon.code} · {couponLabel(o.coupon)}
              </dt>
              <dd className="font-amount">{o.coupon.amount > 0 ? `− ${tk(o.coupon.amount)}` : "Applied"}</dd>
            </div>
          )}
          {!!o.weight && (
            <div className="flex justify-between">
              <dt className="text-muted">Parcel weight</dt>
              <dd className="font-amount">{o.weight} kg</dd>
            </div>
          )}
          <div className="flex justify-between text-[16px]">
            <dt className="font-bold">Total</dt>
            <dd className="font-amount">{tk(o.total)}</dd>
          </div>
        </dl>
        {o.deliveryQuote && o.status !== "cancelled" && (
          <form
            className="mt-3 flex items-end gap-2 rounded-xl bg-amber-50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDelivery();
            }}
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor="delivery-charge">Delivery charge for this location (৳)</Label>
              <Input id="delivery-charge" type="number" inputMode="decimal" min={0} value={charge} placeholder="e.g. 150" onChange={(e) => setCharge(e.target.value)} />
            </div>
            <Button type="submit" variant="dark">
              Set charge
            </Button>
          </form>
        )}
      </section>

      {/* private note + history */}
      <section className="rounded-2xl border border-line p-4">
        <Label htmlFor="admin-note">Private note (only you see this)</Label>
        <Textarea id="admin-note" rows={2} placeholder="e.g. Packed with extra bag, courier picked up 4pm" value={o.adminNote ?? ""} onChange={(e) => save({ ...o, adminNote: e.target.value })} />
        <h3 className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">History</h3>
        <ol className="flex flex-col gap-1.5 text-[13px]">
          {[...o.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`} className="flex items-center justify-between gap-3">
              <StatusChip status={h.status} />
              <span className="text-muted">{fmtWhen(h.at)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11.5px] text-faint">{shopName} · order id {o.id.slice(0, 8)}</p>
      </section>

      <DeleteOrder order={o} />
    </div>
  );
}

/** Removes the order for good (a test order, a duplicate, spam). Its receipt, if one was made, is kept. */
function DeleteOrder({ order }: { order: Order }) {
  const { deleteOrder } = useStore();
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const del = () => {
    if (!armed) {
      setArmed(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    deleteOrder(order.id);
    toast(`Order ${order.code} deleted`);
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 p-4">
      <div className="min-w-0">
        <p className="text-[14px] font-bold">Delete this order</p>
        <p className="text-[12.5px] text-muted">
          {armed
            ? "Tap again to delete it for good - this can't be undone."
            : `Removes it from your list and from Order status.${order.invoiceNumber ? ` Receipt ${order.invoiceNumber} is kept.` : ""}`}
        </p>
      </div>
      <Button variant="ghost" size="sm" className={cx(armed ? "bg-red-600 text-white hover:bg-red-700" : "text-red-600 hover:bg-red-50")} onClick={del}>
        <Trash2 className="size-3.5" /> {armed ? "Yes, delete" : "Delete order"}
      </Button>
    </section>
  );
}
