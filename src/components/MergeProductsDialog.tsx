"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageOff, Layers, Loader2, Search, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { forget } from "@/lib/photos";
import { isUploadedPhoto, thumb, tk } from "@/lib/site";
import type { Product, VariantKind, VariantSize } from "@/lib/types";
import {
  CUSTOM_MAX,
  SIZES,
  SIZE_LABEL,
  VARIANT_KINDS,
  type VariantSpec,
  clampAmount,
  hasAmount,
  hasVariants,
  kindInfo,
  mergeProducts,
  parseName,
  pickKeeper,
  planMerge,
  specMissing,
  suggestMerges,
  textsDiffer,
  variantLabel,
} from "@/lib/variants";
import { Modal } from "./Modal";
import { Button, Input, Select, cx, useToast } from "./ui";

// "Merge sizes": products saved once per size (APT Zero 100 ml, 200 ml, 500 ml…) become one product with variants.
// Each size keeps its own price, discount, purchase price, stock, weight and photo; the product keeps the page,
// description and photos of the one with the most written about it. The same picture saved twice is kept once.

type Spec = VariantSpec;
interface Draft {
  name: string;
  specs: Record<string, Spec>;
}

const groupKey = (g: Product[]) => g.map((p) => p.id).sort().join(",");

/** A first guess at what each product is, for products picked by hand. */
function guess(products: Product[]): Draft {
  const plan = planMerge(products);
  if (plan) return { name: plan.name, specs: Object.fromEntries(plan.variants) };
  const parts = products.map((p) => ({ p, n: parseName(p.name) }));
  return {
    name: parseName(pickKeeper(products).name).base,
    specs: Object.fromEntries(parts.map(({ p, n }) => [p.id, n.amount ? { kind: n.amount.kind, amount: n.amount.amount } : n.size ? { kind: "size" as const, size: n.size } : { kind: "ml" as const }])),
  };
}

/** What is wrong with a group before it can be merged ("" = nothing). */
function problem(products: Product[], d: Draft): string {
  if (!d.name.trim()) return "Give the product a name";
  const labels = products.map((p) => d.specs[p.id]).map((s) => (s ? variantLabel(s) : ""));
  const missing = products.find((p) => {
    const s = d.specs[p.id];
    return !s || !!specMissing(s);
  });
  if (missing) {
    const s = d.specs[missing.id];
    return `"${missing.name.trim()}" needs ${s ? specMissing(s) : "a kind of variant"}`;
  }
  const twice = labels.find((l, i) => labels.indexOf(l) !== i);
  if (twice) return `Two products are both ${twice}`;
  return "";
}

/**
 * Pictures that are the same photo saved twice (each upload is its own file): compared as small 32 x 32 copies, so
 * only a copy of the very same picture matches. Maps each copy to the first one. Photos that can't be read are
 * treated as different.
 */
async function samePictures(urls: string[]): Promise<Map<string, string>> {
  const read = (src: string) =>
    new Promise<{ src: string; w: number; h: number; px: Uint8ClampedArray } | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 32;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0, 32, 32);
          resolve({ src, w: img.naturalWidth, h: img.naturalHeight, px: g.getImageData(0, 0, 32, 32).data });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = thumb(src);
    });
  const pics = (await Promise.all([...new Set(urls)].map(read))).filter((x): x is NonNullable<typeof x> => !!x);
  const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) if (i % 4 !== 3) s += Math.abs(a[i]! - b[i]!);
    return s / ((a.length / 4) * 3);
  };
  const same = new Map<string, string>();
  pics.forEach((p, i) => {
    const first = pics.slice(0, i).find((q) => !same.has(q.src) && q.w === p.w && q.h === p.h && diff(q.px, p.px) < 1.5);
    if (first) same.set(p.src, first.src);
  });
  return same;
}

function SpecPicker({ spec, onChange, label }: { spec: Spec; onChange: (s: Spec) => void; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-[136px] shrink-0">
      <Select
        className="h-9 text-[13px]"
        value={spec.kind}
        aria-label={`Kind of variant for ${label}`}
        onChange={(e) => {
          const kind = e.target.value as VariantKind;
          onChange({ kind, amount: hasAmount(kind) ? clampAmount(kind, spec.amount) : undefined, size: kind === "size" ? (spec.size ?? "small") : undefined, name: kind === "custom" ? (spec.name ?? "") : undefined });
        }}
      >
        {VARIANT_KINDS.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </Select>
      </span>
      {hasAmount(spec.kind) ? (
        <>
          <span className="w-[84px] shrink-0">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={kindInfo(spec.kind).whole ? "1" : "any"}
            className="h-9 text-right text-[13px] font-semibold"
            value={spec.amount ?? ""}
            placeholder="Amount"
            aria-label={`Amount in ${kindInfo(spec.kind).unit} for ${label}`}
            onChange={(e) => onChange({ ...spec, amount: e.target.value === "" ? undefined : Number(e.target.value) })}
            onBlur={() => onChange({ ...spec, amount: clampAmount(spec.kind, spec.amount) })}
          />
          </span>
          <span className="w-8 text-[12.5px] font-semibold text-muted">{kindInfo(spec.kind).unit}</span>
        </>
      ) : spec.kind === "size" ? (
        <span className="w-[122px] shrink-0">
          <Select className="h-9 text-[13px]" value={spec.size ?? "small"} aria-label={`Size for ${label}`} onChange={(e) => onChange({ ...spec, size: e.target.value as VariantSize })}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {SIZE_LABEL[s]}
              </option>
            ))}
          </Select>
        </span>
      ) : spec.kind === "custom" ? (
        <span className="w-[160px] shrink-0">
          <Input
            className="h-9 text-[13px]"
            value={spec.name ?? ""}
            maxLength={CUSTOM_MAX}
            placeholder="e.g. Red, Pack of 3"
            aria-label={`Variant name for ${label}`}
            onChange={(e) => onChange({ ...spec, name: e.target.value })}
          />
        </span>
      ) : (
        <span className="w-[122px] text-[13px] font-bold">Full bag</span>
      )}
    </span>
  );
}

function GroupCard({ products, draft, onDraft, onMerge, busy }: { products: Product[]; draft: Draft; onDraft: (d: Draft) => void; onMerge: () => void; busy: boolean }) {
  const keep = pickKeeper(products);
  const why = problem(products, draft);
  const differ = textsDiffer(products.map((p) => p.description)) || textsDiffer(products.map((p) => p.specification));
  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted">Product name</span>
          <Input value={draft.name} onChange={(e) => onDraft({ ...draft, name: e.target.value })} aria-label="Merged product name" className="font-bold" />
        </label>
        <Button variant="primary" onClick={onMerge} disabled={!!why || busy} title={why || undefined}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />} Merge {products.length} products
        </Button>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {products.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas text-faint">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photo */}
              {p.images?.[0] ? <img src={thumb(p.images[0])} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{p.name.trim()}</span>
              <span className="text-[12px] text-muted">
                {tk(p.price)}
                {p.inStock === false ? " · out of stock" : ""}
                {p.id === keep.id ? " · keeps its page" : ""}
              </span>
            </span>
            <SpecPicker label={p.name.trim()} spec={draft.specs[p.id] ?? { kind: "ml" }} onChange={(s) => onDraft({ ...draft, specs: { ...draft.specs, [p.id]: s } })} />
          </li>
        ))}
      </ul>
      <p className={cx("mt-2 text-[12px]", why ? "text-amber-700" : "text-muted")}>
        {why
          ? `${why}.`
          : `Becomes one product, "${draft.name.trim()}", with ${products.length} variants. Each keeps its price, stock, weight and photo${differ ? "; their descriptions differ, so each is kept under its size" : ""}.`}
      </p>
    </div>
  );
}

export function MergeProductsDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { products, setProducts } = useStore();
  const toast = useToast();
  const latest = useRef(products);
  useEffect(() => {
    latest.current = products;
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // merges made while the dialog is open, newest first, so they can be undone
  const [done, setDone] = useState<{ id: string; name: string; before: Product[]; drop: string[] }[]>([]);
  // copies of the same picture are deleted when the dialog closes (until then an undo brings them back)
  const doneRef = useRef(done);
  useEffect(() => {
    doneRef.current = done;
  });
  useEffect(() => () => doneRef.current.forEach((m) => m.drop.forEach(forget)), []);

  const suggestions = useMemo(() => suggestMerges(products), [products]);
  const draftFor = (g: Product[]) => drafts[groupKey(g)] ?? guess(g);
  const setDraft = (g: Product[], d: Draft) => setDrafts((all) => ({ ...all, [groupKey(g)]: d }));

  const merge = async (group: Product[]) => {
    const k = groupKey(group);
    const d = draftFor(group);
    if (problem(group, d) || busy) return;
    setBusy(k);
    try {
      const same = await samePictures(group.flatMap((p) => p.images ?? []));
      const ids = new Set(group.map((p) => p.id));
      const now = latest.current;
      const fresh = group.map((g) => now.find((p) => p.id === g.id)).filter((p): p is Product => !!p);
      if (fresh.length !== group.length) return toast("Those products changed meanwhile - try again", "err");
      const plan = { name: d.name.trim(), variants: new Map(Object.entries(d.specs).filter(([id]) => ids.has(id))) };
      const { product, removed } = mergeProducts(fresh, plan, same);
      const gone = new Set(removed);
      setProducts(now.filter((p) => !gone.has(p.id)).map((p) => (p.id === product.id ? product : p)));
      // the copies of a picture kept once: their files go when the dialog closes
      const drop = [...same.keys()].filter((src) => isUploadedPhoto(src) && !product.images?.includes(src));
      setDone((list) => [{ id: product.id, name: product.name, before: fresh, drop }, ...list]);
      setPicked((ps) => ps.filter((id) => !ids.has(id)));
      toast(`Merged into "${product.name}" with ${product.variants!.length} variants`);
    } finally {
      setBusy("");
    }
  };

  const undo = (m: (typeof done)[number]) => {
    const now = latest.current;
    const merged = now.find((p) => p.id === m.id);
    if (!merged) return;
    setProducts([...now.filter((p) => p.id !== m.id), ...m.before]);
    setDone((list) => list.filter((x) => x !== m));
    toast(`Split "${m.name}" back into ${m.before.length} products`);
  };

  const pickable = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products
      .filter((p) => !hasVariants(p) && p.name.trim() && (!t || p.name.toLowerCase().includes(t) || picked.includes(p.id)))
      .sort((a, b) => Number(picked.includes(b.id)) - Number(picked.includes(a.id)) || a.name.localeCompare(b.name, undefined, { numeric: true }))
      .slice(0, 40);
  }, [products, q, picked]);
  const manual = picked.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p && !hasVariants(p));

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      icon={<Layers className="size-5" />}
      title="Merge sizes into one product"
      subtitle="Products saved once per size become one product, and customers pick the size on its page"
    >
      <div className="flex flex-col gap-4 bg-canvas/60 p-4 sm:p-5">
        {done.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-2xl bg-soft p-3">
            {done.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Check className="size-4 text-brand" />
                <span className="min-w-0 flex-1">
                  Merged <b>{m.name}</b> ({m.before.length} sizes)
                </span>
                <button type="button" onClick={() => onOpen(m.id)} className="rounded-lg px-2.5 py-1 font-bold text-aqua-deep hover:bg-white">
                  Open
                </button>
                <button type="button" onClick={() => undo(m)} className="flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold text-muted hover:bg-white hover:text-ink">
                  <Undo2 className="size-3.5" /> Undo
                </button>
              </div>
            ))}
          </div>
        )}

        <section>
          <h3 className="mb-2 text-[14px] font-bold">
            Suggested <span className="font-normal text-muted">· same name apart from the size</span>
          </h3>
          {suggestions.length ? (
            <div className="flex flex-col gap-3">
              {suggestions.map((g) => (
                <GroupCard key={groupKey(g)} products={g} draft={draftFor(g)} onDraft={(d) => setDraft(g, d)} onMerge={() => void merge(g)} busy={busy === groupKey(g)} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-[13px] text-muted ring-1 ring-line">No more products look like sizes of each other. Pick some yourself below.</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-bold">
            Pick products yourself <span className="font-normal text-muted">· tick the sizes of one product</span>
          </h3>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products to merge" className="pl-9" />
            </div>
            <ul className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
              {pickable.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-canvas">
                      <input type="checkbox" checked={on} onChange={() => setPicked((ps) => (on ? ps.filter((x) => x !== p.id) : [...ps, p.id]))} className="size-4 accent-brand" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.name.trim()}</span>
                      <span className="text-[12px] tabular-nums text-muted">{tk(p.price)}</span>
                    </label>
                  </li>
                );
              })}
              {!pickable.length && <li className="px-2 py-4 text-center text-[13px] text-muted">No product matches</li>}
            </ul>
            <p className="mt-1 px-2 text-[11.5px] text-muted">Products already sold in variants aren&apos;t listed - add sizes to them in their product form.</p>
          </div>
          {manual.length >= 2 && (
            <div className="mt-3">
              <GroupCard products={manual} draft={draftFor(manual)} onDraft={(d) => setDraft(manual, d)} onMerge={() => void merge(manual)} busy={busy === groupKey(manual)} />
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
