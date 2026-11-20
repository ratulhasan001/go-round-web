"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Landmark, Loader2, Lock, Minus, Plus, ShoppingBag, TicketPercent, Trash2, Wallet, X } from "lucide-react";
import { deliveryFee, extraKg, needsTrxAtCheckout, splitPoliceStation, tk, waLink } from "@/lib/site";
import { POLICIES } from "@/lib/policies";
import { couponAmount } from "@/lib/couponRules";
import { DELIVERY_AREAS, type DeliveryArea, type OrderPayMethod } from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { rememberOrder, useShop } from "./StoreContext";
import { useFreshCart } from "./CartView";
import { PaymentInfo } from "./PaymentInfo";
import { WhatsAppIcon } from "./Icons";
import { useSavedContact } from "./useSavedContact";
import { Panel, SeaField, SeaInput, SeaTextarea, btn, cx } from "./ui";

// "I accept the privacy policy, Terms and Conditions and Return Policy."
const ACCEPT_LABEL = { "privacy-policy": "privacy policy", "terms-and-conditions": "Terms and Conditions", "return-policy": "Return Policy" } as const;

interface Me {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export function CheckoutView() {
  const { shop, online, lines, subtotal, ready, clear, refresh, links, setQty, remove } = useShop();
  const router = useRouter();
  const note = useFreshCart();
  const s = shop.site;
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", ps: "", note: "", zone: "", method: "bKash" as OrderPayMethod, trxId: "", sender: "", password: "" });
  const [area, setArea] = useState<DeliveryArea | "">("");
  const [accept, setAccept] = useState(false);
  const [makeAccount, setMakeAccount] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // a coupon typed in the order summary, once the server has checked it (it is checked again when the order is placed)
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; pct: number; freeDelivery: boolean; label: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // logged in? fill in the saved details
  useEffect(() => {
    fetch("/api/site/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        const a = b?.account as Me | null | undefined;
        setMe(a ?? null);
        if (a) {
          const saved = splitPoliceStation(a.address);
          setF((x) => ({ ...x, name: x.name || a.name, phone: x.phone || a.phone, email: x.email || a.email, address: x.address || saved.address, ps: x.ps || saved.ps }));
        }
      })
      .catch(() => setMe(null));
  }, []);

  // a returning guest: typing their number brings back the details they gave us last time (blank fields only)
  const saved = useSavedContact(f.phone, me === null, (c) => {
    if (c.account) return;
    const saved = splitPoliceStation(c.address);
    setF((x) => ({ ...x, name: x.name.trim() ? x.name : c.name, email: x.email.trim() ? x.email : c.email, address: x.address.trim() ? x.address : saved.address, ps: x.ps.trim() ? x.ps : saved.ps }));
    setErrors(({ name: _n, address: _a, email: _e, ps: _p, ...rest }) => (void _n, void _a, void _e, void _p, rest));
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => (void _drop, rest));
  };
  // zones saved before couriers were listed have no area: they all show at once
  const areas = DELIVERY_AREAS.filter((a) => s.zones.some((z) => z.area === a.id));
  const options = areas.length ? s.zones.filter((z) => z.area === area) : s.zones;
  const weight = lines.reduce((sum, l) => sum + (l.weight ?? 0) * l.qty, 0);
  const picked = s.zones.find((z) => z.id === f.zone);
  const { zone, fee, quote, extra } = deliveryFee(s, f.zone, subtotal, weight);
  const couponOff = coupon ? couponAmount(subtotal, picked && !quote ? fee : 0, coupon) : 0;
  const total = Math.round((subtotal + (picked ? fee : 0) - couponOff) * 100) / 100;
  const clearError = (k: string) => setErrors(({ [k]: _drop, ...rest }) => (void _drop, rest));

  if (!ready) return <div className="h-96 animate-pulse rounded-[28px] bg-sea-sand/50" />;
  if (!lines.length)
    return (
      <div className="grid place-items-center rounded-[28px] border border-dashed border-sea-line px-6 py-20 text-center">
        <ShoppingBag className="size-9 text-sea-muted" />
        <p className="mt-4 font-serif text-[26px]">Your cart is empty</p>
        <Link href={links.store("/products")} className={btn("primary", "lg", "mt-6")}>
          Go to the shop
        </Link>
      </div>
    );
  if (!s.open || !online)
    return (
      <Panel className="mx-auto max-w-xl text-center">
        <p className="font-serif text-[26px]">{!s.open ? "Online orders are paused" : "Online ordering is coming soon"}</p>
        <p className="mt-2 text-[15px] text-sea-body">Please send us your order on WhatsApp - we&apos;ll take it from there.</p>
        <a
          href={waLink(s.whatsapp, `Hi! I'd like to order:\n${lines.map((l) => `• ${l.name} × ${l.qty}`).join("\n")}`)}
          target="_blank"
          rel="noopener noreferrer"
          className={btn("primary", "lg", "mt-6")}
        >
          <WhatsAppIcon className="size-5 text-wa" /> Order on WhatsApp
        </a>
      </Panel>
    );

  const trxNeeded = needsTrxAtCheckout(s, f.method);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const missing: Record<string, string> = {};
    if (!f.ps.trim()) missing.ps = "Please enter your police station (thana).";
    if (!picked) missing.zone = areas.length && !area ? "Please choose inside or outside Dhaka." : "Please choose a delivery service.";
    if (!accept) missing.accept = "Please accept the privacy policy, terms and conditions and return policy.";
    if (Object.keys(missing).length) {
      setErrors((x) => ({ ...x, ...missing }));
      const first = Object.keys(missing)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (trxNeeded && !f.trxId.trim()) {
      setErrors((x) => ({ ...x, trxId: "Please pay first, then type the transaction ID here." }));
      formRef.current?.querySelector<HTMLElement>('[name="trxId"]')?.focus();
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const res = await fetch("/api/site/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, accept, coupon: coupon?.code ?? "", password: !me && makeAccount ? f.password : "", items: lines.map((l) => ({ id: l.id, qty: l.qty })) }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.order) {
        rememberOrder(b.order.code, b.order.customer.phone);
        clear();
        router.push(`${links.orderStatus(b.order.code)}&placed=1`);
        return;
      }
      if (b.fields) {
        setErrors(b.fields);
        // the coupon was refused (used meanwhile, or not for this mobile number): it comes off the total
        if (b.fields.coupon && coupon) {
          setCouponInput(coupon.code);
          setCoupon(null);
        }
        const first = Object.keys(b.fields)[0];
        formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      } else if (b.error === "unavailable" && Array.isArray(b.ids)) {
        const products = await fetch("/api/site/products").then((r) => r.json()).catch(() => null);
        if (products?.products) refresh(products.products);
        setProblem(b.message);
      } else setProblem(b.message ?? `Something went wrong (error ${res.status}). Please try again, or order on WhatsApp.`);
    } catch {
      setProblem("You seem to be offline. Check your connection and try again.");
    }
    setBusy(false);
  };

  /** Checks the coupon code typed in the order summary and, when it's good, shows its discount. */
  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    clearError("coupon");
    const res = await fetch("/api/site/coupon", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, phone: f.phone, name: f.name }) }).catch(() => null);
    const b = await res?.json().catch(() => null);
    if (res?.ok && b?.coupon) {
      setCoupon(b.coupon);
      setCouponInput("");
    } else setErrors((x) => ({ ...x, coupon: b?.message ?? "Couldn't check the coupon. Please try again." }));
    setCouponBusy(false);
  };

  // bKash in its own pink, so customers spot it at once
  const methodCard = (m: OrderPayMethod, icon: React.ReactNode, hint: string, brand?: string) => (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 transition",
        f.method === m ? "border-sea-ink ring-2 ring-sea-ink/10" : "border-sea-line hover:border-sea-ink/30",
      )}
    >
      <input type="radio" name="method" value={m} checked={f.method === m} onChange={() => setF((x) => ({ ...x, method: m }))} className="sr-only" />
      <span className={cx("grid size-10 shrink-0 place-items-center rounded-full", brand ?? (f.method === m ? "bg-sea-ink text-white" : "bg-sea-sand text-sea-ink"))}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold">{m}</span>
        <span className="block text-[12.5px] text-sea-muted">{hint}</span>
      </span>
      <span className={cx("ml-auto size-5 shrink-0 rounded-full border-2", f.method === m ? "border-[6px] border-sea-ink" : "border-sea-line")} />
    </label>
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-6">
        {note && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-800">{note}</p>}

        <Panel>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-serif text-[24px]">1. Customer form</h2>
              <p className="mt-1 text-[13px] text-sea-muted">
                {me === null ? "Start with your number - if you've ordered before, we'll fill in the rest." : "Your details go straight into our customer list, so we know where to send your order."}
              </p>
            </div>
            {me === null && (
              <Link href={`${links.store("/account")}?next=checkout`} className="text-[13.5px] font-bold text-sea-teal hover:underline">
                Have an account? Log in
              </Link>
            )}
            {me && <span className="text-[13px] font-semibold text-sea-leaf">Logged in as {me.name}</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SeaField label="WhatsApp number" hint="for order updates" error={errors.phone} htmlFor="c-phone">
              <SeaInput id="c-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={set("phone")} invalid={!!errors.phone} required />
            </SeaField>
            <SeaField label="Full name" error={errors.name} htmlFor="c-name">
              <SeaInput id="c-name" name="name" autoComplete="name" value={f.name} onChange={set("name")} invalid={!!errors.name} required />
            </SeaField>
            {saved && (
              <p role="status" className="rounded-2xl bg-sea-leaf/10 px-4 py-3 text-[13.5px] font-semibold text-sea-ink sm:col-span-2">
                {saved.account ? (
                  <>
                    This number has an account.{" "}
                    <Link href={`${links.store("/account")}?next=checkout`} className="font-bold text-sea-teal underline underline-offset-4">
                      Log in
                    </Link>{" "}
                    to use your saved details - or just fill them in below.
                  </>
                ) : (
                  <>Welcome back, {saved.name.split(" ")[0]}! We filled in the details you gave us last time - change anything that&apos;s different.</>
                )}
              </p>
            )}
            <SeaField label="Delivery address" hint="police station is a must" error={errors.address} className="sm:col-span-2" htmlFor="c-address">
              <SeaTextarea id="c-address" name="address" autoComplete="street-address" rows={3} placeholder="House, road, area, district" value={f.address} onChange={set("address")} invalid={!!errors.address} required />
            </SeaField>
            <SeaField label="Police station (thana)" hint="required" error={errors.ps} htmlFor="c-ps">
              <SeaInput id="c-ps" name="ps" value={f.ps} onChange={set("ps")} placeholder="e.g. Dhanmondi" invalid={!!errors.ps} required />
            </SeaField>
            <SeaField label="Email" hint="optional" error={errors.email} htmlFor="c-email">
              <SeaInput id="c-email" name="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} invalid={!!errors.email} />
            </SeaField>
          </div>
          {me === null && (
            <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-sea-line">
              <label className="flex cursor-pointer items-center gap-3 text-[14px] font-bold">
                <input type="checkbox" checked={makeAccount} onChange={(e) => setMakeAccount(e.target.checked)} className="size-[18px] accent-sea-ink" />
                Create an account for faster checkout next time
              </label>
              {makeAccount && (
                <SeaField label="Choose a password" hint="at least 8 characters" error={errors.password} className="mt-3" htmlFor="c-pw">
                  <SeaInput id="c-pw" name="password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} invalid={!!errors.password} />
                </SeaField>
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="font-serif text-[24px]">2. Delivery zone</h2>
          <p className="mb-5 mt-1 text-[13px] text-sea-muted">Pick where we deliver, then the courier service. Charges are for parcels up to 1 kg.</p>
          {errors.zone && (
            <p className="mb-3 text-[13px] font-semibold text-red-600" role="alert">
              {errors.zone}
            </p>
          )}
          {areas.length > 0 && (
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Delivery zone">
              {areas.map((a) => (
                <label key={a.id} className={cx("flex cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white p-4 text-[15.5px] font-extrabold transition", area === a.id ? "border-sea-ink ring-2 ring-sea-ink/10" : "border-sea-line hover:border-sea-ink/30")}>
                  <input
                    type="radio"
                    name="zone"
                    value={a.id}
                    checked={area === a.id}
                    onChange={() => {
                      setArea(a.id);
                      setF((x) => ({ ...x, zone: "" }));
                      clearError("zone");
                    }}
                    className="sr-only"
                  />
                  <span className={cx("size-4 shrink-0 rounded-full border-2", area === a.id ? "border-[5px] border-sea-ink" : "border-sea-line")} />
                  {a.label}
                </label>
              ))}
            </div>
          )}
          {(area || !areas.length) && (
            <div className="mt-4 grid gap-4">
              {[...new Set(options.map((z) => z.courier ?? ""))].map((courier) => {
                const list = options.filter((z) => (z.courier ?? "") === courier);
                const note = list.find((z) => z.note)?.note;
                return (
                  <div key={courier || "delivery"}>
                    {courier && (
                      <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-sea-teal">
                        {courier}
                        <span className="text-[12px] font-semibold normal-case tracking-normal text-sea-muted">
                          ({list.map((z) => z.name.replace(/ delivery$/i, "")).join(", ")} delivery)
                        </span>
                        {note && list.every((z) => z.note === note) && <span className="text-[12px] font-bold normal-case tracking-normal text-amber-700">· {note}</span>}
                      </p>
                    )}
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {list.map((z) => (
                        <label key={z.id} className={cx("flex cursor-pointer items-start justify-between gap-3 rounded-2xl border bg-white p-4 transition", f.zone === z.id ? "border-sea-ink ring-2 ring-sea-ink/10" : "border-sea-line hover:border-sea-ink/30")}>
                          <input
                            type="radio"
                            name={areas.length ? "zone-service" : "zone"}
                            value={z.id}
                            checked={f.zone === z.id}
                            onChange={() => {
                              setF((x) => ({ ...x, zone: z.id }));
                              clearError("zone");
                            }}
                            className="sr-only"
                          />
                          <span className="min-w-0">
                            <span className="block text-[15px] font-bold">{z.name}</span>
                            {z.eta && (
                              <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-sea-muted">
                                <Clock className="size-3.5 shrink-0" /> {z.eta}
                              </span>
                            )}
                            {z.note && !list.every((y) => y.note === z.note) && <span className="mt-0.5 block text-[12px] font-semibold text-amber-700">{z.note}</span>}
                          </span>
                          <span className="shrink-0 text-right text-[14px] font-extrabold tabular-nums">{z.quote ? <span className="text-[12.5px] font-bold text-sea-muted">By location</span> : tk(z.fee)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {(() => {
                const kinds = [...new Set(options.filter((z) => z.perKg).map((z) => `${z.courier ? `${z.courier}: ` : ""}+${tk(z.perKg!)}`))];
                return kinds.length ? <p className="text-[12.5px] leading-relaxed text-sea-muted">Items over 1 kg: {kinds.join(" · ")} per extra kg.</p> : null;
              })()}
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-5 font-serif text-[24px]">3. Payment</h2>
          {errors.method && <p className="mb-3 text-[13px] font-semibold text-red-600">{errors.method}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {methodCard("bKash", <Wallet className="size-5" />, "Send money from your bKash", "bg-[#E2136E] text-white")}
            {methodCard("Bank Transfer", <Landmark className="size-5" />, "From any bank account or app")}
          </div>
          <div className="mt-4">
            <PaymentInfo shop={shop} method={f.method} amount={total} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SeaField label={f.method === "bKash" ? "Transaction ID (TrxID)" : "Transaction / reference no."} hint={trxNeeded ? "required" : "add it after you pay"} error={errors.trxId} htmlFor="c-trx">
              <SeaInput id="c-trx" name="trxId" autoCapitalize="characters" placeholder={f.method === "bKash" ? "e.g. 9KL7XQ2M4P" : ""} value={f.trxId} onChange={set("trxId")} invalid={!!errors.trxId} />
            </SeaField>
            <SeaField label={f.method === "bKash" ? "Paid from (bKash number)" : "Paid from (account name)"} hint="optional" htmlFor="c-sender">
              <SeaInput id="c-sender" name="sender" value={f.sender} onChange={set("sender")} />
            </SeaField>
          </div>
          <ol className="mt-4 grid gap-2 rounded-2xl bg-white p-4 text-[13px] leading-relaxed text-sea-body ring-1 ring-sea-line sm:grid-cols-3">
            {[
              trxNeeded ? `Pay ${tk(total)} and type the transaction ID above` : "Place the order, ask us for the bank details, then send the reference",
              "We check the payment by hand and approve your order",
              "Your receipt is then ready to download on your order page",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sea-ink text-[11px] font-extrabold text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[28px] border border-sea-line bg-sea-paper p-6">
          <h2 className="font-serif text-[22px]">Order summary</h2>
          {/* the cart can still be changed here: more or fewer of an item, or take it out - the totals follow */}
          <ul className="mt-4 grid max-h-[22rem] gap-3.5 overflow-y-auto pr-1">
            {lines.map((l) => (
              <li key={l.id} className="flex gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-sea-line">
                  <ProductImage src={l.image} name={l.name} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-[13.5px] font-bold leading-snug">{l.name}</span>
                    <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">{tk(l.price * l.qty)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex h-8 items-center rounded-full border border-sea-line bg-white">
                      <button
                        type="button"
                        onClick={() => setQty(l.id, l.qty - 1)}
                        disabled={busy || l.qty <= 1}
                        className="grid size-8 place-items-center rounded-full text-sea-ink hover:bg-sea-sand/60 disabled:opacity-35 disabled:hover:bg-transparent"
                        aria-label={`One less ${l.name}`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-[13px] font-extrabold tabular-nums" aria-live="polite">
                        {l.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(l.id, l.qty + 1)}
                        disabled={busy || l.qty >= 99}
                        className="grid size-8 place-items-center rounded-full text-sea-ink hover:bg-sea-sand/60 disabled:opacity-35 disabled:hover:bg-transparent"
                        aria-label={`One more ${l.name}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="text-[12px] text-sea-muted tabular-nums">× {tk(l.price)}</span>
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      disabled={busy}
                      className="ml-auto grid size-8 place-items-center rounded-full text-sea-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-35"
                      aria-label={`Remove ${l.name}`}
                      title="Remove"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid gap-2 border-t border-sea-line pt-4 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-sea-body">Subtotal</dt>
              <dd className="font-bold tabular-nums">{tk(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-sea-body">{picked ? <>Delivery · {zone}</> : "Delivery"}</dt>
              <dd className="shrink-0 text-right font-bold tabular-nums">{!picked ? <span className="text-[12.5px] text-sea-muted">Choose a zone</span> : quote ? <span className="text-[12.5px] text-sea-muted">By location</span> : fee ? tk(fee) : "Free"}</dd>
            </div>
            {picked && extra > 0 && (
              <p className="-mt-1 text-[12px] text-sea-muted">
                Includes {tk(extra)} for {extraKg(weight)} extra kg ({Math.round(weight * 100) / 100} kg in total)
              </p>
            )}
            {picked && quote && <p className="-mt-1 text-[12px] leading-relaxed text-amber-700">The charge depends on your location - we&apos;ll message you the delivery charge after you order.</p>}
            {coupon && (
              <div className="flex justify-between gap-3 text-sea-leaf">
                <dt className="font-semibold">
                  Coupon {coupon.code} · {coupon.label}
                </dt>
                <dd className="shrink-0 font-bold tabular-nums">{couponOff > 0 ? `− ${tk(couponOff)}` : coupon.freeDelivery && quote ? "Free delivery" : tk(0)}</dd>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-sea-line pt-3 text-[18px]">
              <dt className="font-extrabold">Total</dt>
              <dd className="font-extrabold tabular-nums">{tk(total)}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-sea-line pt-4">
            {coupon ? (
              <p className="flex items-center justify-between gap-3 rounded-xl bg-sea-leaf/10 px-3 py-2.5 text-[13px] font-bold text-sea-ink">
                <span className="flex min-w-0 items-center gap-2">
                  <TicketPercent className="size-4 shrink-0 text-sea-leaf" />
                  <span className="truncate">
                    {coupon.code} applied · {coupon.label}
                  </span>
                </span>
                <button type="button" onClick={() => setCoupon(null)} className="grid size-7 shrink-0 place-items-center rounded-full text-sea-muted hover:bg-white hover:text-red-600" aria-label="Remove coupon">
                  <X className="size-4" />
                </button>
              </p>
            ) : (
              <>
                <label htmlFor="c-coupon" className="text-[13px] font-bold text-sea-ink">
                  Coupon code <span className="font-semibold text-sea-muted">(optional)</span>
                </label>
                <div className="mt-1.5 flex gap-2">
                  <SeaInput
                    id="c-coupon"
                    name="coupon"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      clearError("coupon");
                    }}
                    // Enter checks the coupon instead of placing the order
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void applyCoupon())}
                    autoCapitalize="characters"
                    autoComplete="off"
                    invalid={!!errors.coupon}
                    className="!text-[14px]"
                  />
                  <button type="button" onClick={() => void applyCoupon()} disabled={!couponInput.trim() || couponBusy} className={btn("outline", "md", "shrink-0")}>
                    {couponBusy ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
                {errors.coupon && <p className="mt-1.5 text-[12.5px] font-semibold text-red-600">{errors.coupon}</p>}
              </>
            )}
          </div>
          <div className="mt-5 border-t border-sea-line pt-4">
            <label htmlFor="c-note" className="text-[13px] font-bold text-sea-ink">
              Add note <span className="font-semibold text-sea-muted">(optional)</span>
            </label>
            <SeaTextarea id="c-note" name="note" rows={2} value={f.note} onChange={set("note")} placeholder="e.g. call before delivery" className="mt-1.5 !text-[14px]" />
            <label className={cx("mt-4 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug", errors.accept ? "text-red-700" : "text-sea-body")}>
              <input
                type="checkbox"
                name="accept"
                checked={accept}
                onChange={(e) => {
                  setAccept(e.target.checked);
                  clearError("accept");
                }}
                className="mt-0.5 size-[18px] shrink-0 accent-sea-ink"
              />
              <span>
                I accept the{" "}
                {POLICIES.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 && (i === POLICIES.length - 1 ? " and " : ", ")}
                    <Link href={links.store(`/${p.slug}`)} target="_blank" className="font-bold text-sea-teal underline-offset-2 hover:underline">
                      {ACCEPT_LABEL[p.slug]}
                    </Link>
                  </span>
                ))}
                .
              </span>
            </label>
            {errors.accept && <p className="mt-1.5 text-[12.5px] font-semibold text-red-600">{errors.accept}</p>}
          </div>
          {problem && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700" role="alert">
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={btn("primary", "lg", "mt-5 w-full")}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Place order · {tk(total)}
          </button>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-sea-muted">We approve your payment by hand, then your receipt is ready to download.</p>
        </div>
      </aside>
    </form>
  );
}
