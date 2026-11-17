"use client";

import { useEffect, useRef, useState } from "react";
import { CloudUpload, ImagePlus, Images, Info, Loader2, Star, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { tk, thumb } from "@/lib/site";
import type { Product } from "@/lib/types";
import { Modal } from "./Modal";
import { DescriptionEditor } from "./DescriptionEditor";
import { Input, Switch, cx, useToast } from "./ui";
import { forget, storePhoto } from "@/lib/photos";

const MAX_PHOTOS = 8;

const subExample = (category: string) => (/filter/i.test(category) ? "Filter media, Filter accessories" : /plant/i.test(category) ? "Stem plants, Carpet plants" : "a type within it");

/** Numbers typed into the form: "" clears the value. */
const num = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Number(v) || 0));
const uniq = (list: (string | undefined)[]) => [...new Set(list.map((x) => x?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

/** Photo button for a product row: shows how many photos it has and opens the full product form. */
export function ProductDetailsButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const n = product.images?.length ?? 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx("relative grid h-10 flex-1 place-items-center rounded-lg transition", "text-faint hover:bg-aqua-soft hover:text-aqua-deep")}
        aria-label={`Photos and details for ${product.name || "product"}`}
        title="Photos & details"
      >
        <Images className="size-4" />
        {n > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-aqua-deep px-1 text-[10px] font-bold text-white">{n}</span>}
      </button>
      {open && <ProductDetailsDialog productId={product.id} onClose={() => setOpen(false)} />}
    </>
  );
}

function Label({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline gap-1.5 text-[13.5px] font-semibold text-ink">
      {children}
      {required && <span className="text-red-500">*</span>}
      {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
    </span>
  );
}

/** The full product form: name, description, specification, SKU, brand, categories, prices, stock, weight, warranty and photos. */
export function ProductDetailsDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { products, setProducts, mode } = useStore();
  const toast = useToast();
  const thumbRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0); // photos still uploading
  const [drag, setDrag] = useState(false);
  // the newest list, so photos finishing one after another don't overwrite each other
  const latest = useRef(products);
  useEffect(() => {
    latest.current = products;
  });

  const p = products.find((x) => x.id === productId);
  if (!p) return null;
  const images = p.images ?? [];
  const categories = uniq(products.map((x) => x.category));
  const brands = uniq(products.map((x) => x.brand));
  const units = uniq(["pcs", "bottle", "pack", "kg", "litre", "set", ...products.map((x) => x.unit)]);
  const same = (a?: string, b?: string) => !!a?.trim() && a.trim().toLowerCase() === b?.trim().toLowerCase();
  // subcategories already used in this product's category, and types in its subcategory
  const subcategories = uniq(products.filter((x) => same(x.category, p.category)).map((x) => x.subcategory));
  const subsubs = uniq(products.filter((x) => same(x.category, p.category) && same(x.subcategory, p.subcategory)).map((x) => x.subsubcategory));
  const discounted = (p.regularPrice ?? 0) > p.price;
  const regular = discounted ? p.regularPrice! : p.price;

  const update = (patch: Partial<Product>) =>
    setProducts(latest.current.map((x) => (x.id === productId ? { ...x, ...patch, updatedAt: Date.now() } : x)));
  const currentImages = () => latest.current.find((x) => x.id === productId)?.images ?? [];

  const add = async (files: File[], asCover = false) => {
    const room = MAX_PHOTOS - currentImages().length;
    const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, asCover ? 1 : room));
    if (!picked.length) return toast(room <= 0 && !asCover ? `Up to ${MAX_PHOTOS} photos per product` : "Choose a photo file", "err");
    setBusy((b) => b + picked.length);
    let failed = 0;
    for (const f of picked) {
      try {
        const url = await storePhoto(f, mode === "cloud");
        const now = currentImages();
        update({ images: asCover ? [url, ...now].slice(0, MAX_PHOTOS) : [...now, url] });
      } catch {
        failed++;
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (failed) toast(`${failed} photo${failed === 1 ? "" : "s"} couldn't be uploaded`, "err");
    else toast(asCover ? "Thumbnail added" : picked.length === 1 ? "Photo added" : `${picked.length} photos added`);
  };
  const remove = (src: string) => {
    update({ images: images.filter((x) => x !== src) });
    forget(src);
  };
  const pick = (ref: React.RefObject<HTMLInputElement | null>) => ref.current?.click();
  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, cover: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/*"
      multiple={!cover}
      hidden
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        void add(files, cover);
      }}
    />
  );
  const section = "rounded-2xl border border-line bg-white p-4 sm:p-5";

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      icon={<Images className="size-5" />}
      title={p.name.trim() ? "Edit product" : "Add product"}
      subtitle={`${p.name.trim() || "New product"} · ${tk(p.price)}${p.unit ? ` / ${p.unit}` : ""} · changes save automatically`}
    >
      <div className="flex flex-col gap-4 bg-canvas/60 p-4 sm:p-5">
        {/* name, description, specification */}
        <div className={cx(section, "flex flex-col gap-4")}>
          <label className="block">
            <Label required>Product name</Label>
            <Input value={p.name} placeholder="Type product name here" autoFocus={!p.name.trim()} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <div>
            <Label>Description</Label>
            <DescriptionEditor value={p.description ?? ""} placeholder="Type description here - what it is, who it's for, how to use it…" onChange={(description) => update({ description })} />
          </div>
          <div>
            <Label>Specification</Label>
            <DescriptionEditor value={p.specification ?? ""} placeholder="Size, power, contents, dosage…" onChange={(specification) => update({ specification })} />
          </div>
        </div>

        {/* codes and groups */}
        <div className={cx(section, "grid gap-4 sm:grid-cols-2")}>
          <label className="block">
            <Label hint="your own code for it">SKU</Label>
            <Input value={p.sku ?? ""} placeholder="Product SKU" onChange={(e) => update({ sku: e.target.value })} />
          </label>
          <label className="block">
            <Label>Brand</Label>
            <Input list="product-brands" value={p.brand ?? ""} placeholder="Select or type a brand" onChange={(e) => update({ brand: e.target.value })} />
            <datalist id="product-brands">
              {brands.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <Label required>Category</Label>
            <Input list="product-categories" value={p.category ?? ""} placeholder="e.g. Fertilizer, Light, Filtration" onChange={(e) => update({ category: e.target.value })} />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <Label>Sub category</Label>
            <Input
              list="product-subcategories"
              value={p.subcategory ?? ""}
              disabled={!p.category?.trim()}
              placeholder={p.category?.trim() ? `e.g. ${subExample(p.category)}` : "Pick a category first"}
              onChange={(e) => update({ subcategory: e.target.value })}
            />
            <datalist id="product-subcategories">
              {subcategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <Label>Sub sub category</Label>
            <Input
              list="product-subsubs"
              value={p.subsubcategory ?? ""}
              disabled={!p.subcategory?.trim()}
              placeholder={p.subcategory?.trim() ? "A type within the sub category" : "Pick a sub category first"}
              onChange={(e) => update({ subsubcategory: e.target.value })}
            />
            <datalist id="product-subsubs">
              {subsubs.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <Label>Unit</Label>
            <Input list="product-units" value={p.unit ?? ""} placeholder="Select or type a unit" onChange={(e) => update({ unit: e.target.value })} />
            <datalist id="product-units">
              {units.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          {p.category?.trim() && (
            <p className="text-[12px] text-muted sm:col-span-2">
              On the website: {p.brand?.trim() && <b className="text-ink">{p.brand.trim()} · </b>}
              <b className="text-ink">{[p.category, p.subcategory, p.subsubcategory].map((x) => x?.trim()).filter(Boolean).join(" › ")}</b> · customers filter the shop by brand and category.
            </p>
          )}
        </div>

        {/* prices, stock, weight, warranty */}
        <div className={cx(section, "grid gap-4 sm:grid-cols-2")}>
          <label className="block sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
            <Label hint="admin only, never on the website">Purchase price</Label>
            <Input type="number" inputMode="decimal" min={0} value={p.purchasePrice ?? ""} placeholder="Purchase price" onChange={(e) => update({ purchasePrice: num(e.target.value) })} />
          </label>
          <label className="block">
            <Label required>Regular price</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={regular || ""}
              placeholder="Regular price"
              onChange={(e) => {
                const v = num(e.target.value) ?? 0;
                update(discounted && p.price < v ? { regularPrice: v } : { price: v, regularPrice: undefined });
              }}
            />
          </label>
          <label className="block">
            <Label hint="leave empty for no discount">Discounted price</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={discounted ? p.price : ""}
              placeholder="Discounted price"
              onChange={(e) => {
                const v = num(e.target.value);
                update(v && v < regular ? { price: v, regularPrice: regular } : { price: regular, regularPrice: undefined });
              }}
            />
          </label>
          {discounted && (
            <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-brand sm:col-span-2">
              <Info className="size-3.5" /> Customers pay {tk(p.price)} - {tk(regular)} shows crossed out ({Math.round((1 - p.price / regular) * 100)}% off). Receipts use {tk(p.price)}.
            </p>
          )}
          <label className="block">
            <Label hint="empty = not counted">Stock quantity</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={p.stock ?? ""}
              placeholder="Stock quantity"
              onChange={(e) => {
                const v = num(e.target.value);
                const stock = v === undefined ? undefined : Math.floor(v);
                update({ stock, ...(stock !== undefined ? { inStock: stock > 0 } : {}) });
              }}
            />
          </label>
          <label className="block">
            <Label hint="for the delivery charge">Weight (kg)</Label>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={p.weight ?? ""} placeholder="Weight (kg)" onChange={(e) => update({ weight: num(e.target.value) })} />
          </label>
          <div className="sm:col-span-2">
            <Label>Warranty</Label>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
                <input type="radio" name={`warranty-${p.id}`} checked={!p.warranty} onChange={() => update({ warranty: "" })} className="size-[18px] accent-brand" />
                No warranty
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
                <input type="radio" name={`warranty-${p.id}`} checked={!!p.warranty} onChange={() => update({ warranty: "6 months" })} className="size-[18px] accent-brand" />
                Seller warranty
              </label>
              {!!p.warranty && <Input className="max-w-48" value={p.warranty} placeholder="e.g. 6 months" aria-label="Warranty period" onChange={(e) => update({ warranty: e.target.value || " " })} />}
            </div>
          </div>
        </div>

        {/* photos */}
        <div className={section}>
          <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
            <div>
              <Label hint="any size">Upload thumbnail image</Label>
              {images[0] ? (
                <div className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photo */}
                  <img src={thumb(images[0])} alt="" className="size-full object-cover" />
                  <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1">
                    <button type="button" onClick={() => pick(thumbRef)} className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[12px] font-bold text-ink shadow hover:bg-white">
                      Change
                    </button>
                    <button type="button" onClick={() => remove(images[0]!)} className="grid size-8 place-items-center rounded-lg bg-white/90 text-red-600 shadow hover:bg-white" aria-label="Remove thumbnail">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pick(thumbRef)}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-aqua-deep hover:bg-aqua-soft hover:text-aqua-deep"
                >
                  {busy ? <Loader2 className="size-7 animate-spin" /> : <CloudUpload className="size-8" />}
                  <span className="text-[13px] font-semibold">Upload thumbnail image</span>
                </button>
              )}
              {fileInput(thumbRef, true)}
            </div>
            <div>
              <Label hint="JPG, PNG, WebP · any size">Product gallery</Label>
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-600">
                <Info className="size-3.5" /> Please use original product images.
              </p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  void add([...e.dataTransfer.files]);
                }}
                className={cx("grid grid-cols-3 gap-2.5 rounded-2xl p-1 transition sm:grid-cols-4", drag && "bg-aqua-soft ring-2 ring-aqua-deep/40")}
              >
                {images.slice(1).map((src) => (
                  <div key={src} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photo */}
                    <img src={thumb(src)} alt="" className="size-full object-cover" />
                    <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => update({ images: [src, ...images.filter((x) => x !== src)] })}
                        className="grid size-8 place-items-center rounded-lg bg-white/90 text-ink shadow transition hover:bg-white active:scale-90"
                        aria-label="Use as thumbnail"
                        title="Use as thumbnail"
                      >
                        <Star className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(src)}
                        className="grid size-8 place-items-center rounded-lg bg-white/90 text-red-600 shadow transition hover:bg-white active:scale-90"
                        aria-label="Remove photo"
                        title="Remove"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {Array.from({ length: busy }, (_, i) => (
                  <div key={`busy-${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-line bg-canvas text-muted">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ))}
                {images.length + busy < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => pick(galleryRef)}
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-aqua-deep hover:bg-aqua-soft hover:text-aqua-deep"
                  >
                    <ImagePlus className="size-6" />
                    <span className="text-[12px] font-semibold">Add photos</span>
                  </button>
                )}
              </div>
              {fileInput(galleryRef, false)}
            </div>
          </div>
          {mode !== "cloud" && <p className="mt-3 text-[12px] text-amber-700">Saved on this device only, as smaller copies. Connect the cloud database to show photos on the live website.</p>}
        </div>

        {/* website */}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-line">
            <span>
              <span className="block text-[14px] font-bold">Show on website</span>
              <span className="block text-[12px] text-muted">{p.onSite !== false ? "Customers can see and order it" : "Hidden - receipts only"}</span>
            </span>
            <Switch checked={p.onSite !== false} label="Show on website" onChange={(v) => update({ onSite: v })} />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-line">
            <span>
              <span className="block text-[14px] font-bold">Feature on home page</span>
              <span className="block text-[12px] text-muted">{p.featured ? "Shown first on the store" : "Not featured"}</span>
            </span>
            <Switch checked={!!p.featured} label="Feature on home page" onChange={(v) => update({ featured: v })} />
          </label>
        </div>
        {p.inStock === false && <p className="-mt-2 text-[12.5px] text-amber-700">This product is out of stock: the website shows it, but customers can&apos;t add it to their cart.</p>}
        {!(p.price > 0) && <p className="-mt-2 text-[12.5px] text-amber-700">Products without a price aren&apos;t shown on the website.</p>}
      </div>
    </Modal>
  );
}
