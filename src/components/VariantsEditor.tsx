"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, Info, Layers, Plus, Trash2 } from "lucide-react";
import { uid } from "@/lib/calc";
import { thumb, tk } from "@/lib/site";
import type { Product, ProductVariant, VariantKind, VariantSize } from "@/lib/types";
import { purchaseMax, withPurchase } from "@/lib/productPrice";
import { CUSTOM_MAX, FIXED, SIZES, SIZE_LABEL, VARIANT_KINDS, clampAmount, customName, hasAmount, kindInfo, sellable, sortVariants, specMissing, variantLabel, withVariants } from "@/lib/variants";
import { PriceInput } from "./ProductDetailsDialog";
import { Input, Select, Switch, cx } from "./ui";

// The product form's "Variants" section: the sizes or amounts a product is sold in (500 ml, 2 kg, Large, Full bag…),
// each with its own prices, stock, weight, SKU and photo. Customers pick one on the product page.

const SHORT: Record<VariantKind, string> = { kg: "kg", ml: "ml", gm: "gm", l: "Litre", piece: "Piece", pot: "Pot", size: "Size", bag: "Full bag", stem: "10 Stem", pack: "Pack", pad: "Pad", custom: "Custom name" };
const range = (kind: VariantKind) => {
  const k = kindInfo(kind);
  if (!hasAmount(kind)) return "";
  return `${k.min}-${k.max!.toLocaleString("en-US")} ${k.unit}${k.whole ? "" : ` · fractions work too, e.g. ${kind === "l" ? "0.67 L" : "0.5 kg"}`}`;
};

/** A number field that hands its value over when it's left (or on Enter), like the price fields. */
function DraftNumber({ value, onCommit, placeholder, ariaLabel, step, className }: { value: number | undefined; onCommit: (v: number | undefined) => void; placeholder: string; ariaLabel: string; step?: string; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const v = draft.trim() === "" ? undefined : Number(draft);
    if (v !== value && (v === undefined || Number.isFinite(v))) onCommit(v);
  };
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={step ?? "any"}
      value={draft ?? value ?? ""}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
    />
  );
}

/** Which of the product's photos shows when a customer picks the variant. */
function PhotoPick({ images, value, onChange, label }: { images: string[]; value?: string; onChange: (src: string | undefined) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const shown = value && images.includes(value) ? value : undefined;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center overflow-hidden rounded-lg border border-line bg-white text-faint transition hover:border-aqua-deep"
        aria-label={`Photo for ${label}`}
        aria-expanded={open}
        title="Photo shown when a customer picks this variant"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photo */}
        {shown ? <img src={thumb(shown)} alt="" className="size-full object-cover" /> : <ImageOff className="size-4" />}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-30 w-[244px] rounded-xl border border-line bg-white p-2 shadow-xl">
          <p className="px-1 pb-1.5 text-[11.5px] font-semibold text-muted">Photo for {label}</p>
          {images.length ? (
            <div className="grid grid-cols-4 gap-1.5">
              {images.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => (onChange(src), setOpen(false))}
                  className={cx("aspect-square overflow-hidden rounded-lg ring-2 transition", src === shown ? "ring-aqua-deep" : "ring-transparent hover:ring-line")}
                  aria-label="Use this photo"
                  aria-pressed={src === shown}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photo */}
                  <img src={thumb(src)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-1 pb-1 text-[12px] text-muted">Add photos to the product first (below).</p>
          )}
          {shown && (
            <button type="button" onClick={() => (onChange(undefined), setOpen(false))} className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] font-semibold text-muted hover:bg-canvas">
              No photo of its own (show the product&apos;s first photo)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const small = "mb-1 block text-[11.5px] font-semibold text-muted";

function VariantRow({
  v,
  images,
  onChange,
  onRemove,
}: {
  v: ProductVariant;
  images: string[];
  onChange: (patch: Partial<ProductVariant>, resort?: boolean) => void;
  onRemove: () => void;
}) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(t);
  }, [sure]);
  const discounted = (v.regularPrice ?? 0) > v.price;
  const regular = discounted ? v.regularPrice! : v.price;
  const max = purchaseMax(v);
  const label = variantLabel(v);
  return (
    <div className="rounded-xl border border-line bg-canvas/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PhotoPick images={images} value={v.image} label={label} onChange={(image) => onChange({ image })} />
        <span className="w-[160px] shrink-0">
        <Select
          value={v.kind}
          aria-label="Kind of variant"
          onChange={(e) => {
            const kind = e.target.value as VariantKind;
            onChange(
              { kind, amount: hasAmount(kind) ? clampAmount(kind, v.amount) : undefined, size: kind === "size" ? (v.size ?? "small") : undefined, name: kind === "custom" ? (v.name ?? "") : undefined },
              true,
            );
          }}
        >
          {VARIANT_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </Select>
        </span>
        {hasAmount(v.kind) ? (
          <span className="flex items-center gap-1.5">
            <span className="w-24 shrink-0">
            <DraftNumber
              className="text-right font-semibold"
              value={v.amount}
              placeholder="Amount"
              ariaLabel={`Amount in ${kindInfo(v.kind).unit}`}
              step={kindInfo(v.kind).whole ? "1" : "any"}
              onCommit={(n) => onChange({ amount: clampAmount(v.kind, n) }, true)}
            />
            </span>
            <span className="text-[13px] font-semibold text-muted">{kindInfo(v.kind).unit}</span>
          </span>
        ) : v.kind === "size" ? (
          <span className="w-32 shrink-0">
            <Select value={v.size ?? "small"} aria-label="Size" onChange={(e) => onChange({ size: e.target.value as VariantSize }, true)}>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABEL[s]}
                </option>
              ))}
            </Select>
          </span>
        ) : v.kind === "custom" ? (
          <span className="w-56 shrink-0">
            <Input
              value={v.name ?? ""}
              maxLength={CUSTOM_MAX}
              placeholder="e.g. Red, Pack of 3"
              aria-label="Variant name"
              autoFocus={!v.name}
              onChange={(e) => onChange({ name: e.target.value })}
              onBlur={() => v.name !== customName(v.name) && onChange({ name: customName(v.name) })}
            />
          </span>
        ) : (
          <span className="text-[13.5px] font-bold">{FIXED[v.kind]}</span>
        )}
        <span className="flex-1" />
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-muted">
          {v.inStock !== false ? "In stock" : "Out of stock"}
          <Switch checked={v.inStock !== false} label={`${label} in stock`} onChange={(on) => onChange({ inStock: on })} />
        </label>
        <button
          type="button"
          onClick={() => (sure ? onRemove() : setSure(true))}
          className={cx("grid h-9 min-w-9 place-items-center rounded-lg px-2 text-faint transition hover:bg-red-50 hover:text-red-600", sure && "bg-red-600 text-[11.5px] font-bold text-white hover:bg-red-700 hover:text-white")}
          aria-label={`Remove ${label}`}
        >
          {sure ? "Remove?" : <Trash2 className="size-4" />}
        </button>
      </div>
      {hasAmount(v.kind) && <p className="mt-1.5 text-[11.5px] text-muted">{range(v.kind)}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <label className="block">
          <span className={small}>Regular price *</span>
          <PriceInput value={regular} placeholder="Price" ariaLabel={`${label} regular price`} onCommit={(n) => onChange(discounted && v.price < n ? { regularPrice: n } : { price: n, regularPrice: undefined }, true)} />
        </label>
        <label className="block">
          <span className={small}>Discounted price</span>
          <PriceInput
            value={discounted ? v.price : 0}
            placeholder="No discount"
            ariaLabel={`${label} discounted price`}
            onCommit={(n) => onChange(n && n < regular ? { price: n, regularPrice: regular } : { price: regular, regularPrice: undefined }, true)}
          />
        </label>
        <div className="col-span-2 block sm:col-span-1">
          <span className={small}>Purchase price (admin only)</span>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <PriceInput value={v.purchasePrice ?? 0} placeholder="From" ariaLabel={`${label} purchase price from`} onCommit={(n) => onChange(withPurchase(n || undefined, max) as Partial<ProductVariant>)} />
            <span className="text-[11.5px] font-semibold text-muted">to</span>
            <PriceInput value={max ?? 0} placeholder="To" ariaLabel={`${label} purchase price to`} onCommit={(n) => onChange(withPurchase(v.purchasePrice, n || undefined) as Partial<ProductVariant>)} />
          </div>
        </div>
        <label className="block">
          <span className={small}>Stock quantity</span>
          <DraftNumber
            value={v.stock}
            placeholder="Not counted"
            ariaLabel={`${label} stock quantity`}
            step="1"
            onCommit={(n) => {
              const stock = n === undefined ? undefined : Math.max(0, Math.floor(n));
              onChange({ stock, stockAt: Date.now(), ...(stock !== undefined ? { inStock: stock > 0 } : {}) }, true);
            }}
          />
        </label>
        <label className="block">
          <span className={small}>Weight (kg)</span>
          <DraftNumber value={v.weight} placeholder="Weight" ariaLabel={`${label} weight in kg`} onCommit={(n) => onChange({ weight: n === undefined ? undefined : Math.max(0, n) })} />
        </label>
        <label className="block">
          <span className={small}>SKU</span>
          <Input value={v.sku ?? ""} placeholder="Optional" aria-label={`${label} SKU`} onChange={(e) => onChange({ sku: e.target.value || undefined })} />
        </label>
      </div>
      {discounted && (
        <p className="mt-2 text-[12px] text-brand">
          Customers pay {tk(v.price)} - {tk(regular)} shows crossed out ({Math.round((1 - v.price / regular) * 100)}% off).
        </p>
      )}
    </div>
  );
}

/** The variants section of the product form. */
export function VariantsEditor({ p, update }: { p: Product; update: (patch: Partial<Product>) => void }) {
  const list = p.variants ?? [];
  const images = p.images ?? [];
  const save = (next: ProductVariant[], resort = false) => update(withVariants(p, resort ? sortVariants(next) : next));

  const add = (kind: VariantKind) => {
    const fresh: ProductVariant = { id: uid(), kind, price: 0 };
    if (kind === "size") fresh.size = SIZES.find((s) => !list.some((v) => v.kind === "size" && v.size === s)) ?? "small";
    // the first variant starts with the product's own prices, stock, weight and photo
    const first: ProductVariant | null = list.length
      ? null
      : {
          ...fresh,
          price: p.price,
          ...((p.regularPrice ?? 0) > p.price ? { regularPrice: p.regularPrice } : {}),
          ...(p.purchasePrice !== undefined ? { purchasePrice: p.purchasePrice, purchasePriceMax: p.purchasePriceMax } : {}),
          ...(p.inStock === false ? { inStock: false } : {}),
          ...(typeof p.stock === "number" ? { stock: p.stock, stockAt: p.stockAt } : {}),
          ...(p.weight ? { weight: p.weight } : {}),
          ...(p.sku?.trim() ? { sku: p.sku.trim() } : {}),
          ...(images[0] ? { image: images[0] } : {}),
        };
    save([...list, first ?? fresh]);
  };

  const labels = list.map(variantLabel);
  const twice = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
  // what each variant still needs before customers see it
  const incomplete = list
    .filter((v) => !sellable(v))
    .map((v) => `${variantLabel(v)} needs ${[!(v.price > 0) && "a price", specMissing(v)].filter(Boolean).join(" and ")}`);
  const shown = sortVariants(list.filter(sellable)).map(variantLabel);

  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-1.5 flex items-baseline gap-1.5 text-[13.5px] font-semibold text-ink">
        <Layers className="size-4 self-center text-aqua-deep" /> Variants
        <span className="text-[12px] font-normal text-muted">sizes or amounts it&apos;s sold in, each with its own price</span>
      </div>
      {!list.length && (
        <p className="mb-3 text-[12.5px] text-muted">
          Sold in more than one size? Add each one here instead of saving the product again for every size - customers then see the product once and pick a size on its page.
        </p>
      )}
      {list.length > 0 && (
        <div className="mb-3 mt-3 flex flex-col gap-2.5">
          {list.map((v) => (
            <VariantRow
              key={v.id}
              v={v}
              images={images}
              onChange={(patch, resort) => save(list.map((x) => (x.id === v.id ? { ...x, ...patch } : x)), resort)}
              onRemove={() => save(list.filter((x) => x.id !== v.id))}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12.5px] font-semibold text-muted">Add a variant:</span>
        {VARIANT_KINDS.map((k) => {
          const full = (!!FIXED[k.kind] && list.some((v) => v.kind === k.kind)) || (k.kind === "size" && SIZES.every((s) => list.some((v) => v.kind === "size" && v.size === s)));
          return (
            <button
              key={k.kind}
              type="button"
              disabled={full}
              onClick={() => add(k.kind)}
              title={`${k.label}${range(k.kind) ? ` · ${range(k.kind)}` : ""}`}
              className="flex h-8 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12.5px] font-bold text-body transition hover:border-aqua-deep hover:bg-aqua-soft hover:text-aqua-deep disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-white disabled:hover:text-body"
            >
              <Plus className="size-3.5" /> {SHORT[k.kind]}
            </button>
          );
        })}
      </div>
      {list.length > 0 && (
        <div className="mt-3 flex flex-col gap-1 text-[12px]">
          <p className="text-muted">
            On the website:{" "}
            {shown.length ? (
              <>
                <b className="text-ink">Available variants: {shown.join(" · ")}</b> - customers pick one; the price, stock and photo follow it. Lists show the cheapest one in stock
                {list.filter(sellable).length > 1 ? " as \"From\"" : ""}.
              </>
            ) : (
              <b className="text-amber-700">no variant has a price yet, so the product isn&apos;t shown.</b>
            )}
          </p>
          {incomplete.length > 0 && (
            <p className="flex items-center gap-1.5 text-amber-700">
              <Info className="size-3.5 shrink-0" /> Not shown yet: {incomplete.join("; ")}.
            </p>
          )}
          {twice.length > 0 && (
            <p className="flex items-center gap-1.5 text-amber-700">
              <Info className="size-3.5 shrink-0" /> Listed twice: {twice.join(", ")} - customers can&apos;t tell them apart.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
