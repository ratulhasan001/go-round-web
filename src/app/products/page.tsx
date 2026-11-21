"use client";

import { useMemo, useState } from "react";
import { ImageOff, Package } from "lucide-react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/calc";
import type { Product } from "@/lib/types";
import { ListEditor } from "@/components/ListEditor";
import { cx } from "@/components/ui";
import { PriceInput, ProductDetailsButton, ProductDetailsDialog } from "@/components/ProductDetailsDialog";
import { isDiscounted, purchaseMax, regularOf, withPurchase, withRegular, withUnitPrice } from "@/lib/productPrice";
import { thumb } from "@/lib/site";

const inStock = (p: Product) => p.inStock !== false;
const byName = (a: Product, b: Product) => a.name.trim().localeCompare(b.name.trim(), undefined, { numeric: true, sensitivity: "base" });
const updated = (p: Product) => p.updatedAt ?? 0;
const fmtUpdated = (p: Product) =>
  p.updatedAt ? `Updated ${new Date(p.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Not edited recently";

export default function ProductsPage() {
  const { products, setProducts, invoices } = useStore();

  // units sold per product name, for "Best selling"
  const sold = useMemo(() => {
    const m = new Map<string, number>();
    for (const inv of invoices) for (const it of inv.items) m.set(it.description.trim().toLowerCase(), (m.get(it.description.trim().toLowerCase()) ?? 0) + (Number(it.qty) || 1));
    return m;
  }, [invoices]);
  const units = (p: Product) => sold.get(p.name.trim().toLowerCase()) ?? 0;
  const [formFor, setFormFor] = useState<string | null>(null); // a new product opens straight in the full form

  return (
    <>
    <ListEditor<Product>
      section="products"
      tableFrom="wide"
      tableMin="880px"
      title="Products"
      subtitle="Your price list - used on receipts and on your website. Tap the photo button for the full product form: photos, description, specification, brand, category, prices, stock and weight."
      icon={<Package className="size-5" />}
      noun="Product"
      rows={products}
      onChange={setProducts}
      blank={() => ({ id: uid(), name: "", price: 0, inStock: true, updatedAt: Date.now() })}
      onAdd={(p) => setFormFor(p.id)}
      touch={(p) => ({ ...p, updatedAt: Date.now() })}
      sorts={[
        { label: "Recently updated", compare: (a, b) => updated(b) - updated(a) },
        { label: "Oldest updated", compare: (a, b) => updated(a) - updated(b) },
        { label: "Name A → Z", compare: byName },
        { label: "Name Z → A", compare: (a, b) => byName(b, a) },
        { label: "Price: low to high", compare: (a, b) => a.price - b.price || byName(a, b) },
        { label: "Price: high to low", compare: (a, b) => b.price - a.price || byName(a, b) },
        { label: "Best selling", compare: (a, b) => units(b) - units(a) || byName(a, b) },
        { label: "In stock first", compare: (a, b) => Number(inStock(b)) - Number(inStock(a)) || byName(a, b) },
        { label: "Out of stock first", compare: (a, b) => Number(inStock(a)) - Number(inStock(b)) || byName(a, b) },
      ]}
      filters={[
        { label: "In stock", test: inStock },
        { label: "Out of stock", test: (p) => !inStock(p) },
        { label: "On website", test: (p) => p.onSite !== false },
        { label: "Hidden from website", test: (p) => p.onSite === false },
        { label: "No photo", test: (p) => !p.images?.length },
        { label: "On discount", test: (p) => (p.regularPrice ?? 0) > p.price },
        { label: "No brand", test: (p) => !p.brand?.trim() },
      ]}
      rowActions={(p) => <ProductDetailsButton product={p} />}
      lead={(p) => (
        <span
          key={String(inStock(p))}
          title={`${inStock(p) ? "In stock" : "Out of stock"}${p.onSite === false ? " · hidden from website" : ""} · ${fmtUpdated(p)}`}
          className={cx(
            "animate-lead-pop relative grid size-9 place-items-center overflow-hidden rounded-xl",
            inStock(p) ? "bg-soft text-brand" : "bg-red-50 text-red-500",
            p.onSite === false && "opacity-50",
          )}
        >
          {p.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded product photo
            <img src={thumb(p.images[0])} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <ImageOff className="size-[16px]" />
          )}
          {/* stock dot */}
          <span className={cx("absolute bottom-0.5 right-0.5 size-2 rounded-full ring-2 ring-white", inStock(p) ? "bg-lime" : "bg-red-500")} />
        </span>
      )}
      columns={[
        { key: "name", label: "Product name", placeholder: "e.g. Seachem Prime 325ml", width: "minmax(140px,2fr)" },
        { key: "unit", label: "Unit", placeholder: "e.g. pcs, bottle", width: "minmax(66px,120px)" },
        { key: "inStock", label: "Status", type: "toggle", on: "In stock", off: "Out of stock", width: "minmax(120px,150px)" },
        {
          key: "purchasePrice",
          label: "Purchase price (BDT)",
          type: "custom",
          width: "minmax(146px,210px)",
          // one figure, or a range when it varies ("1200 - 1500"); the "to" box only shows while editing or when set
          render: (p, update) => {
            const max = purchaseMax(p);
            return (
              <div className="flex items-center gap-1.5">
                <PriceInput value={p.purchasePrice ?? 0} placeholder="0.00" ariaLabel="Purchase price from" className="text-right font-semibold" onCommit={(v) => update(withPurchase(v || undefined, max))} />
                <span className={cx("text-[12px] font-semibold text-muted", !max && "[fieldset:disabled_&]:hidden")}>to</span>
                <PriceInput value={max ?? 0} placeholder="max" ariaLabel="Purchase price to" className={cx("text-right font-semibold", !max && "[fieldset:disabled_&]:hidden")} onCommit={(v) => update(withPurchase(p.purchasePrice, v || undefined))} />
              </div>
            );
          },
        },
        {
          key: "regularPrice",
          label: "Regular price (BDT)",
          type: "custom",
          width: "minmax(92px,150px)",
          // the price before any discount; the same as the unit price when there is none
          render: (p, update) => <PriceInput value={regularOf(p)} placeholder="0.00" ariaLabel="Regular price" className={cx("text-right font-semibold", isDiscounted(p) && "text-muted line-through")} onCommit={(v) => update(withRegular(p, v))} />,
        },
        {
          key: "price",
          label: "Unit price (BDT)",
          type: "custom",
          width: "minmax(92px,150px)",
          // what the customer pays: the sale price when the product is on discount
          render: (p, update) => <PriceInput value={p.price} placeholder="0.00" ariaLabel="Unit price" className={cx("text-right font-semibold", isDiscounted(p) && "text-brand")} onCommit={(v) => update(withUnitPrice(p, v))} />,
        },
      ]}
    />
    {formFor && <ProductDetailsDialog productId={formFor} onClose={() => setFormFor(null)} />}
    </>
  );
}
