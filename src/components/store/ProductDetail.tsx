"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Minus, Plus, ShieldCheck, Truck, Wallet } from "lucide-react";
import { richHtml, tk, waLink, type PublicProduct, type PublicVariant } from "@/lib/site";
import { ProductImage } from "./ProductImage";
import { useShop } from "./StoreContext";
import { WhatsAppIcon } from "./Icons";
import { btn, cx } from "./ui";

/** The variant shown first: the one the address asks for, else the first in stock (smallest first), else the first. */
const firstVariant = (p: PublicProduct, wanted?: string) => p.variants.find((v) => v.id === wanted) ?? p.variants.find((v) => v.inStock) ?? p.variants[0];
const photoOf = (p: PublicProduct, v?: PublicVariant) => Math.max(0, v?.image ? p.images.indexOf(v.image) : 0);

export function ProductDetail({ p, variant, rating }: { p: PublicProduct; variant?: string; rating?: { avg: number; count: number } }) {
  const { add, shop, links } = useShop();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [vid, setVid] = useState(() => firstVariant(p, variant)?.id);
  const sel = p.variants.find((v) => v.id === vid);
  const [pic, setPic] = useState(() => photoOf(p, sel));
  // what is on sale: the picked variant, or the product itself
  const price = sel?.price ?? p.price;
  const regular = sel ? sel.regularPrice : p.regularPrice;
  const inStock = sel ? sel.inStock : p.inStock;
  const stock = sel ? sel.stock : p.stock;
  const weight = sel ? sel.weight : p.weight;
  const sku = sel?.sku || p.sku;
  const fullName = sel ? `${p.name} - ${sel.label}` : p.name;
  const pick = (v: PublicVariant) => {
    setVid(v.id);
    setQty((q) => Math.max(1, Math.min(q, v.stock ?? 99)));
    if (v.image) setPic(photoOf(p, v));
    // the address names the variant, so a shared link opens on it
    const url = new URL(window.location.href);
    url.searchParams.set("v", v.id);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="aspect-square overflow-hidden rounded-[28px] bg-sea-sand ring-1 ring-sea-line">
          <ProductImage key={pic} src={p.images[pic]} name={p.name} thumb={false} eager className="animate-fade-up" />
        </div>
        {p.images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {p.images.map((src, i) => (
              <button
                key={src}
                onClick={() => setPic(i)}
                className={cx("size-[72px] shrink-0 overflow-hidden rounded-2xl ring-2 transition", i === pic ? "ring-sea-teal" : "ring-transparent opacity-70 hover:opacity-100")}
                aria-label={`Photo ${i + 1}`}
                aria-pressed={i === pic}
              >
                <ProductImage src={src} name="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {p.category && (
          <p className="store-eyebrow flex flex-wrap items-center gap-x-2 !text-sea-leaf">
            <Link href={`${links.store("/products")}?category=${encodeURIComponent(p.category)}`} className="hover:underline">
              {p.category}
            </Link>
            {p.subcategory && (
              <>
                <span aria-hidden className="text-sea-muted">›</span>
                <Link href={`${links.store("/products")}?category=${encodeURIComponent(p.category)}&sub=${encodeURIComponent(p.subcategory)}`} className="hover:underline">
                  {p.subcategory}
                </Link>
              </>
            )}
            {p.subsubcategory && (
              <>
                <span aria-hidden className="text-sea-muted">›</span>
                <Link href={`${links.store("/products")}?category=${encodeURIComponent(p.category)}&sub=${encodeURIComponent(p.subcategory)}&type=${encodeURIComponent(p.subsubcategory)}`} className="hover:underline">
                  {p.subsubcategory}
                </Link>
              </>
            )}
          </p>
        )}
        <h1 className="mt-3 font-serif text-[34px] leading-[1.08] sm:text-[44px]">{p.name}</h1>
        {(p.brand || sku || (rating && rating.count > 0)) && (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] font-semibold text-sea-muted">
            {p.brand && (
              <Link href={`${links.store("/products")}?brand=${encodeURIComponent(p.brand)}`} className="text-sea-ink hover:underline">
                Brand: <b>{p.brand}</b>
              </Link>
            )}
            {sku && <span>SKU: {sku}</span>}
            {rating && rating.count > 0 && (
              <a href="#reviews" className="flex items-center gap-1.5 hover:text-sea-ink">
                <span className="text-amber-500">{"★".repeat(Math.round(rating.avg))}</span>
                {rating.avg.toFixed(1)} ({rating.count})
              </a>
            )}
          </p>
        )}
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 text-[28px] font-extrabold tabular-nums">
          <span>
            {tk(price)}
            {!sel && p.unit && <span className="text-[15px] font-semibold text-sea-muted"> / {p.unit}</span>}
          </span>
          {regular > 0 && (
            <>
              <s className="text-[18px] font-semibold text-sea-muted">{tk(regular)}</s>
              <span className="rounded-full bg-sea-teal px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wider text-white">Save {tk(regular - price)}</span>
            </>
          )}
        </p>

        {p.variants.length > 0 && (
          <fieldset className="mt-6">
            <legend className="text-[13.5px] font-bold text-sea-muted">
              Available variants: <span className="text-sea-ink">{p.variants.map((v) => v.label).join(" · ")}</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.variants.map((v) => (
                <label key={v.id} className="cursor-pointer">
                  <input type="radio" name={`variant-${p.id}`} value={v.id} checked={v.id === vid} onChange={() => pick(v)} className="peer sr-only" />
                  <span
                    className={cx(
                      "flex min-h-11 items-center rounded-full border px-4 text-[14px] font-bold tabular-nums transition peer-focus-visible:ring-4 peer-focus-visible:ring-sea-teal/25",
                      v.id === vid ? "border-sea-ink bg-sea-ink text-white" : "border-sea-line bg-white text-sea-body hover:border-sea-ink/40",
                      !v.inStock && v.id !== vid && "text-sea-muted line-through decoration-sea-muted/50",
                    )}
                  >
                    {v.label}
                    {!v.inStock && <span className="sr-only"> (sold out)</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <p className={cx(p.variants.length ? "mt-4" : "mt-2", "flex w-fit items-center gap-2 text-[13.5px] font-bold", inStock ? "text-sea-leaf" : "rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-red-600")}>
          <span className={cx("size-2 rounded-full", inStock ? "bg-sea-leaf" : "bg-red-600")} />
          {inStock ? (stock !== null && stock <= 5 ? `Only ${stock} left` : "In stock") : sel ? `${sel.label} is sold out right now` : "Sold out right now"}
        </p>

        {inStock ? (
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex h-[52px] items-center rounded-full border border-sea-line bg-white">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-[52px] place-items-center rounded-full hover:bg-sea-sand/60" aria-label="One less">
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center text-[16px] font-extrabold tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button onClick={() => setQty((q) => Math.min(99, stock ?? 99, q + 1))} className="grid size-[52px] place-items-center rounded-full hover:bg-sea-sand/60" aria-label="One more">
                <Plus className="size-4" />
              </button>
            </div>
            <button onClick={() => add(p, qty, sel)} className={btn("outline", "lg", "flex-1 sm:flex-none")}>
              Add to cart
            </button>
            <button
              onClick={() => {
                add(p, qty, sel);
                router.push(links.store("/checkout"));
              }}
              className={btn("primary", "lg", "w-full sm:w-auto")}
            >
              Buy now
            </button>
          </div>
        ) : (
          <a href={waLink(shop.site.whatsapp, `Hi! When will "${fullName}" be back in stock?`)} target="_blank" rel="noopener noreferrer" className={btn("primary", "lg", "mt-7")}>
            <WhatsAppIcon className="size-[18px] text-wa" /> Ask when it&apos;s back
          </a>
        )}

        {p.description.trim() && <div className="rich-desc mt-9 border-t border-sea-line pt-7 text-[15.5px] leading-relaxed text-sea-body" dangerouslySetInnerHTML={{ __html: richHtml(p.description) }} />}
        {p.specification.trim() && (
          <div className="mt-9 border-t border-sea-line pt-7">
            <h2 className="store-eyebrow">Specification</h2>
            <div className="rich-desc mt-3 text-[15px] leading-relaxed text-sea-body" dangerouslySetInnerHTML={{ __html: richHtml(p.specification) }} />
          </div>
        )}
        {(weight > 0 || p.warranty) && (
          <dl className="mt-7 grid grid-cols-2 gap-3 text-[14px]">
            {weight > 0 && (
              <div className="rounded-2xl bg-sea-paper px-4 py-3 ring-1 ring-sea-line">
                <dt className="text-[12px] font-bold uppercase tracking-wider text-sea-muted">Weight</dt>
                <dd className="mt-0.5 font-extrabold">{weight} kg</dd>
              </div>
            )}
            <div className="rounded-2xl bg-sea-paper px-4 py-3 ring-1 ring-sea-line">
              <dt className="text-[12px] font-bold uppercase tracking-wider text-sea-muted">Warranty</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-extrabold">
                {p.warranty ? (
                  <>
                    <BadgeCheck className="size-4 text-sea-leaf" /> Seller warranty · {p.warranty}
                  </>
                ) : (
                  "No warranty"
                )}
              </dd>
            </div>
          </dl>
        )}

        <ul className="mt-9 grid gap-3 border-t border-sea-line pt-7 text-[14px] text-sea-body">
          <li className="flex gap-3">
            <Truck className="size-5 shrink-0 text-sea-teal" />
            <span>
              {shop.site.deliveryNote.trim() || "Delivery all over Bangladesh"}
              {shop.site.freeDeliveryOver > 0 && ` · free on orders over ${tk(shop.site.freeDeliveryOver)}`}
            </span>
          </li>
          <li className="flex gap-3">
            <Wallet className="size-5 shrink-0 text-sea-teal" /> Pay with bKash or bank transfer
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="size-5 shrink-0 text-sea-teal" /> Packed by hand and checked before it leaves us
          </li>
        </ul>
        <a
          href={waLink(shop.site.whatsapp, `Hi! I have a question about "${fullName}".`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-[14px] font-bold text-sea-ink underline decoration-sea-line underline-offset-4 hover:decoration-sea-ink"
        >
          <WhatsAppIcon className="size-[18px] text-wa" /> Ask about this product
        </a>
      </div>
    </div>
  );
}
