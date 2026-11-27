"use client";

import { useMemo, useState } from "react";
import { ImageOff, Layers, Package, Sprout, Wrench } from "lucide-react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/calc";
import type { Product, ProductGroup } from "@/lib/types";
import { PRODUCT_GROUPS, groupOf } from "@/lib/productGroup";
import { ListEditor } from "@/components/ListEditor";
import { cx } from "@/components/ui";
import { PriceInput, ProductDetailsButton, ProductDetailsDialog } from "@/components/ProductDetailsDialog";
import { isDiscounted, purchaseMax, regularOf, withPurchase, withRegular, withUnitPrice } from "@/lib/productPrice";
import { thumb } from "@/lib/site";
import { hasVariants, saleNames, withVariants } from "@/lib/variants";
import { MergeProductsDialog } from "@/components/MergeProductsDialog";
import { Button, Input } from "@/components/ui";

const inStock = (p: Product) => p.inStock !== false;
const byName = (a: Product, b: Product) => a.name.trim().localeCompare(b.name.trim(), undefined, { numeric: true, sensitivity: "base" });
const updated = (p: Product) => p.updatedAt ?? 0;
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
/** "1,049 - 2,699": the lowest and highest of the variants' figures. */
const spread = (ns: number[]) => {
  const xs = ns.filter((n) => n > 0);
  if (!xs.length) return "-";
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? money(lo) : `${money(lo)} - ${money(hi)}`;
};
/** A variant product's figures in the table, read only: they're edited in the product form, per variant. */
const VariantFigure = ({ text, title }: { text: string; title: string }) => (
  <span className="flex h-10 items-center justify-end px-3 text-right text-[14px] font-semibold tabular-nums text-body" title={title}>
    {text}
  </span>
);
const GROUP_ICON: Record<ProductGroup, React.ReactNode> = { plant: <Sprout className="size-[18px]" />, accessory: <Wrench className="size-[17px]" /> };

/** Plants | Accessories: the admin's product list is always one or the other. */
function GroupSwitch({ value, counts, onChange }: { value: ProductGroup; counts: Record<ProductGroup, number>; onChange: (g: ProductGroup) => void }) {
  return (
    <div role="tablist" aria-label="Product type" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 shadow-sm shadow-black/5 ring-1 ring-line sm:inline-grid sm:min-w-[420px]">
      {PRODUCT_GROUPS.map((g) => {
        const on = g.key === value;
        return (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(g.key)}
            className={cx(
              "flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition active:scale-[0.98]",
              on ? "bg-deep text-lime shadow-md shadow-deep/20" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {GROUP_ICON[g.key]}
            {g.label}
            <span key={counts[g.key]} className={cx("animate-count-bump rounded-full px-2 py-0.5 text-[12px] tabular-nums", on ? "bg-lime/20 text-lime" : "bg-line text-muted")}>
              {counts[g.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
const fmtUpdated = (p: Product) =>
  p.updatedAt ? `Updated ${new Date(p.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Not edited recently";

export default function ProductsPage() {
  const { products, setProducts, invoices } = useStore();

  // units sold per product name, for "Best selling" (a product sold in variants counts every variant's name too)
  const sold = useMemo(() => {
    const m = new Map<string, number>();
    for (const inv of invoices) for (const it of inv.items) m.set(it.description.trim().toLowerCase(), (m.get(it.description.trim().toLowerCase()) ?? 0) + (Number(it.qty) || 1));
    return m;
  }, [invoices]);
  const units = (p: Product) => saleNames(p).reduce((n, name) => n + (sold.get(name.trim().toLowerCase()) ?? 0), 0);
  const [formFor, setFormFor] = useState<string | null>(null); // a new product opens straight in the full form
  const [merging, setMerging] = useState(false);
  const [group, setGroup] = useState<ProductGroup>("plant");
  const counts = useMemo(() => {
    const c: Record<ProductGroup, number> = { plant: 0, accessory: 0 };
    for (const p of products) c[groupOf(p)]++;
    return c;
  }, [products]);
  // only this half is listed; the other half is kept as it is when the list saves
  const shown = useMemo(() => products.filter((p) => groupOf(p) === group), [products, group]);
  // the In stock switch on a product sold in variants switches every variant
  const save = (rows: Product[]) => {
    const before = new Map(products.map((p) => [p.id, p]));
    setProducts([
      ...rows.map((r) => {
        const b = before.get(r.id);
        return b && hasVariants(r) && r.inStock !== b.inStock ? { ...r, ...withVariants(r, r.variants.map((v) => ({ ...v, inStock: r.inStock !== false }))) } : r;
      }),
      ...products.filter((p) => groupOf(p) !== group),
    ]);
  };

  return (
    <>
    <ListEditor<Product>
      key={group}
      section="products"
      tableFrom="wide"
      tableMin="880px"
      title="Products"
      subtitle="Your price list - used on receipts and on your website. Tap the photo button for the full product form: photos, description, specification, brand, category, prices, stock and weight."
      icon={<Package className="size-5" />}
      noun={group === "plant" ? "Plant" : "Accessory"}
      rows={shown}
      onChange={save}
      switcher={<GroupSwitch value={group} counts={counts} onChange={setGroup} />}
      actions={
        <Button onClick={() => setMerging(true)} className="group" title="Combine products saved once per size into one product with variants">
          <Layers className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5" /> Merge sizes
        </Button>
      }
      blank={() => ({ id: uid(), name: "", price: 0, inStock: true, group, updatedAt: Date.now() })}
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
        { label: "With variants", test: (p) => hasVariants(p) },
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
        {
          key: "unit",
          label: "Unit",
          type: "custom",
          width: "minmax(66px,120px)",
          // a product sold in variants has no single unit: its variants are its sizes
          render: (p, update) =>
            hasVariants(p) ? (
              <button
                type="button"
                onClick={() => setFormFor(p.id)}
                className="flex h-10 w-full items-center gap-1.5 rounded-xl bg-aqua-soft px-2.5 text-[12.5px] font-bold text-aqua-deep transition hover:bg-aqua-soft/70"
                title={`Sold in ${p.variants.length} variants - edit them in the product form`}
              >
                <Layers className="size-3.5 shrink-0" /> {p.variants.length} variants
              </button>
            ) : (
              <Input placeholder="e.g. pcs, bottle" aria-label="Unit" value={p.unit ?? ""} onChange={(e) => update({ unit: e.target.value })} />
            ),
        },
        { key: "inStock", label: "Status", type: "toggle", on: "In stock", off: "Out of stock", width: "minmax(120px,150px)" },
        {
          key: "purchasePrice",
          label: "Purchase price (BDT)",
          type: "custom",
          width: "minmax(146px,210px)",
          // one figure, or a range when it varies ("1200 - 1500"); the "to" box only shows while editing or when set
          render: (p, update) => {
            if (hasVariants(p)) return <VariantFigure text={spread(p.variants.flatMap((v) => [v.purchasePrice ?? 0, purchaseMax(v) ?? 0]))} title="Each variant's purchase price - edit them in the product form" />;
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
          render: (p, update) =>
            hasVariants(p) ? (
              <VariantFigure text={spread(p.variants.map(regularOf))} title="Each variant's regular price - edit them in the product form" />
            ) : (
              <PriceInput value={regularOf(p)} placeholder="0.00" ariaLabel="Regular price" className={cx("text-right font-semibold", isDiscounted(p) && "text-muted line-through")} onCommit={(v) => update(withRegular(p, v))} />
            ),
        },
        {
          key: "price",
          label: "Unit price (BDT)",
          type: "custom",
          width: "minmax(92px,150px)",
          // what the customer pays: the sale price when the product is on discount
          render: (p, update) =>
            hasVariants(p) ? (
              <VariantFigure text={spread(p.variants.map((v) => v.price))} title="What customers pay for each variant - edit them in the product form" />
            ) : (
              <PriceInput value={p.price} placeholder="0.00" ariaLabel="Unit price" className={cx("text-right font-semibold", isDiscounted(p) && "text-brand")} onCommit={(v) => update(withUnitPrice(p, v))} />
            ),
        },
      ]}
    />
    {formFor && <ProductDetailsDialog productId={formFor} onClose={() => setFormFor(null)} />}
    {merging && <MergeProductsDialog onClose={() => setMerging(false)} onOpen={(id) => (setMerging(false), setFormFor(id))} />}
    </>
  );
}
