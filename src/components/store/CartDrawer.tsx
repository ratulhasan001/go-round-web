"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { tk } from "@/lib/site";
import { ProductImage } from "./ProductImage";
import { lineHref, useShop } from "./StoreContext";
import { QtyStepper, useFreshCart } from "./CartView";
import { Fish } from "./Art";
import { btn } from "./ui";

/**
 * The cart as a panel that slides in from the right: the cart button opens it, so customers see and change their cart
 * - quantities, removing things - without leaving the page they're on. The cart page (/cart) still works for links.
 */
export function CartDrawer() {
  const { cartOpen, closeCart } = useShop();
  const path = usePathname();
  // going to another page (checkout, a product, back) closes it
  useEffect(() => closeCart(), [path, closeCart]);
  if (!cartOpen) return null;
  return <Panel onClose={closeCart} />;
}

function Panel({ onClose }: { onClose: () => void }) {
  const { lines, subtotal, count, remove, shop, links, ready } = useShop();
  const note = useFreshCart(); // prices and stock brought up to date each time it opens
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind doesn't scroll
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  const free = shop.site.freeDeliveryOver;
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <button className="absolute inset-0 bg-sea-ink/30 backdrop-blur-[2px]" aria-label="Close cart" tabIndex={-1} onClick={onClose} />
      <div className="sea-drawer-in absolute inset-y-0 right-0 flex w-[min(92vw,420px)] flex-col bg-sea-cream shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sea-line px-5">
          <h2 id="cart-title" className="flex items-baseline gap-2 font-serif text-[24px]">
            Your cart
            {count > 0 && <span className="font-sans text-[13px] font-bold text-sea-muted">{count} item{count === 1 ? "" : "s"}</span>}
          </h2>
          <button ref={closeButton} onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-sea-sand/70" aria-label="Close cart">
            <X className="size-[22px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {note && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">{note}</p>}
          {!ready ? (
            <div className="mt-5 h-40 animate-pulse rounded-[22px] bg-sea-sand/50" />
          ) : !lines.length ? (
            <div className="grid place-items-center py-16 text-center">
              <Fish className="sea-bob w-16" />
              <p className="mt-4 font-serif text-[24px]">Your cart is empty</p>
              <p className="mt-1 text-[14px] text-sea-muted">Let&apos;s find something for your tank.</p>
              <Link href={links.store("/products")} onClick={onClose} className={btn("primary", "md", "mt-6")}>
                <ShoppingBag className="size-4" /> Go to the shop
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-sea-line">
              {lines.map((l) => (
                <li key={l.id} className="flex gap-3.5 py-4">
                  <Link href={links.store(lineHref(l))} onClick={onClose} className="size-[72px] shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-sea-line">
                    <ProductImage src={l.image} name={l.name} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={links.store(lineHref(l))} onClick={onClose} className="line-clamp-2 text-[14px] font-bold leading-snug hover:text-sea-teal">
                        {l.name}
                      </Link>
                      <p className="shrink-0 text-[14px] font-extrabold tabular-nums">{tk(l.price * l.qty)}</p>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-sea-muted">
                      {tk(l.price)}
                      {l.unit && ` / ${l.unit}`}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <QtyStepper id={l.id} qty={l.qty} />
                      <button
                        onClick={() => remove(l.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-sea-muted hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${l.name}`}
                      >
                        <Trash2 className="size-4" /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {ready && lines.length > 0 && (
          <div className="shrink-0 border-t border-sea-line bg-sea-paper px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {free > 0 && (
              <p className="mb-3 rounded-xl bg-sea-teal-soft px-3 py-2 text-[12.5px] font-semibold text-sea-teal">
                {subtotal >= free ? "🎉 You get free delivery!" : `Add ${tk(free - subtotal)} more for free delivery.`}
              </p>
            )}
            <div className="flex justify-between text-[15px] font-semibold">
              <span>Subtotal</span>
              <span className="font-extrabold tabular-nums">{tk(subtotal)}</span>
            </div>
            <p className="mt-1 text-[12.5px] text-sea-muted">Delivery is added at checkout · pay with bKash or bank transfer</p>
            <Link href={links.store("/checkout")} onClick={onClose} className={btn("primary", "lg", "mt-4 w-full")}>
              Checkout <ArrowRight className="size-4" />
            </Link>
            <button onClick={onClose} className="mt-2 w-full rounded-full py-2.5 text-[14px] font-bold text-sea-teal hover:bg-sea-sand/60">
              Keep shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
