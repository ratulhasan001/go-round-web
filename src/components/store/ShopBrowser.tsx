"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchX, X } from "lucide-react";
import { inCategory, type ListedProduct } from "@/lib/site";
import { ProductCard } from "./ProductCard";
import { SearchSuggest } from "./SearchSuggest";
import { cx } from "./ui";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Cards built at first, and added each time the customer scrolls near the end. Every product is in the page's data
 * already - search, filters and sorting always cover the whole shop; a phone just doesn't build every card up front.
 */
const STEP = 24;
/** sessionStorage: how many cards each list showed, so "back" from a product returns to the same place. */
const SEEN = "gr-shop-seen";
/**
 * False until the first page is on screen: that first render must match the server's (STEP cards). Lists opened
 * later - e.g. coming back from a product - are built in the browser and may show as many cards as before.
 */
let hydrated = false;

const seenCount = (key: string) => {
  try {
    return Math.max(STEP, Number(JSON.parse(sessionStorage.getItem(SEEN) ?? "{}")[key]) || 0);
  } catch {
    return STEP;
  }
};
const rememberCount = (key: string, n: number) => {
  try {
    sessionStorage.setItem(SEEN, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(SEEN) ?? "{}"), [key]: n }));
  } catch {
    /* private mode */
  }
};

const SORTS = [
  { key: "new", label: "Newest" },
  { key: "low", label: "Price: low to high" },
  { key: "high", label: "Price: high to low" },
  { key: "az", label: "Name A–Z" },
] as const;

export function ShopBrowser({ products }: { products: ListedProduct[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");
  const category = params.get("category") ?? "";
  const subcategory = params.get("sub") ?? "";
  const subsub = params.get("type") ?? "";
  const brand = params.get("brand") ?? "";
  const sort = params.get("sort") ?? "new";
  // from the home page's "See all": only what's on sale, or only featured products
  const show = params.get("show") === "sale" || params.get("show") === "featured" ? params.get("show")! : "";
  const [inStockOnly, setInStockOnly] = useState(false);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  // the subcategories of the chosen category, e.g. Filter › Filter media, Filter accessories
  const subcategories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.subcategory && inCategory(p.category, category)) m.set(p.subcategory, (m.get(p.subcategory) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, category]);

  // one level further down, e.g. Filter › Filter media › Ceramic rings
  const subsubs = useMemo(() => {
    const m = new Map<string, number>();
    if (subcategory) for (const p of products) if (p.subsubcategory && inCategory(p.category, category) && same(p.subcategory, subcategory)) m.set(p.subsubcategory, (m.get(p.subsubcategory) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, category, subcategory]);

  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const setParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const setParam = (k: string, v: string) => setParams({ [k]: v });
  // a new category starts with all of its subcategories
  const pickCategory = (c: string) => setParams({ category: c, sub: "", type: "" });

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter(
      (p) =>
        (!category || inCategory(p.category, category)) &&
        (!subcategory || same(p.subcategory, subcategory)) &&
        (!subsub || same(p.subsubcategory, subsub)) &&
        (!brand || same(p.brand, brand)) &&
        (show !== "sale" || p.regularPrice > p.price) &&
        (show !== "featured" || p.featured) &&
        (!inStockOnly || p.inStock) &&
        words.every((w) => `${p.name} ${p.brand} ${p.sku} ${p.category} ${p.subcategory} ${p.subsubcategory} ${p.text}`.toLowerCase().includes(w)),
    );
    const byName = (a: ListedProduct, b: ListedProduct) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    if (sort === "low") list.sort((a, b) => a.price - b.price || byName(a, b));
    else if (sort === "high") list.sort((a, b) => b.price - a.price || byName(a, b));
    else if (sort === "az") list.sort(byName);
    // sold-out items go last, whatever the order
    return list.sort((a, b) => Number(b.inStock) - Number(a.inStock));
  }, [products, q, category, subcategory, subsub, brand, sort, inStockOnly, show]);

  // how many cards are built (see STEP). ?all=1 shows every card - the "show more" link's own address, for browsers that
  // run no scripts (Opera Mini) and for search engines
  const all = params.get("all") === "1";
  const listKey = [path, category, subcategory, subsub, brand, sort, show, q.trim().toLowerCase(), inStockOnly ? 1 : 0].join("|");
  const [count, setCount] = useState(() => ({ key: listKey, n: hydrated ? seenCount(listKey) : STEP }));
  const n = all ? shown.length : count.key === listKey ? count.n : STEP; // a new search or filter starts from the top
  const showMore = useCallback(() => {
    setCount({ key: listKey, n: n + STEP });
    rememberCount(listKey, n + STEP);
  }, [listKey, n]);
  useEffect(() => {
    hydrated = true;
  }, []);
  const end = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || n >= shown.length || typeof IntersectionObserver === "undefined") return;
    // well before the customer reaches the end, so they never wait for it
    const io = new IntersectionObserver((e) => void (e[0]?.isIntersecting && showMore()), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [n, shown.length, showMore]);
  const allHref = useMemo(() => {
    const next = new URLSearchParams(params.toString());
    next.set("all", "1");
    return `${path}?${next}`;
  }, [params, path]);

  const subChip = (on: boolean) =>
    cx("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold transition", on ? "bg-sea-teal text-white" : "bg-sea-teal-soft text-sea-teal hover:bg-sea-teal/15");
  const chip = (on: boolean) =>
    cx("h-10 shrink-0 rounded-full px-4 text-[13.5px] font-bold transition", on ? "bg-sea-ink text-white" : "border border-sea-line bg-sea-paper text-sea-body hover:border-sea-ink/30");

  return (
    <>
      <div data-shop-bar className="sticky top-16 z-20 -mx-4 mb-8 border-b border-sea-line/70 bg-sea-cream/92 px-4 pb-3 pt-3 backdrop-blur-md sm:top-[72px] sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchSuggest products={products} value={q} onChange={setQ} onCategory={pickCategory} onBrand={(b) => setParam("brand", b)} />
          <div className="flex items-center gap-2 md:ml-auto">
            {brands.length > 0 && (
              <select
                value={brands.find(([b]) => same(b, brand))?.[0] ?? ""}
                onChange={(e) => setParam("brand", e.target.value)}
                aria-label="Brand"
                className="h-11 min-w-0 flex-1 rounded-full border border-sea-line bg-white px-4 text-[13.5px] font-bold text-sea-body outline-none focus:border-sea-teal md:w-40 md:flex-none"
              >
                <option value="">All brands</option>
                {brands.map(([b, n]) => (
                  <option key={b} value={b}>
                    {b} ({n})
                  </option>
                ))}
              </select>
            )}
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-sea-line bg-white px-4 text-[13.5px] font-bold text-sea-body">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4 accent-sea-ink" />
              In stock
            </label>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === "new" ? "" : e.target.value)}
              aria-label="Sort by"
              className="h-11 flex-1 rounded-full border border-sea-line bg-white px-4 text-[13.5px] font-bold text-sea-body outline-none focus:border-sea-teal md:flex-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {categories.length > 0 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
            <button className={chip(!category)} onClick={() => pickCategory("")}>
              All
            </button>
            {categories.map(([c, n]) => (
              <button key={c} className={chip(same(category, c))} onClick={() => pickCategory(c)} aria-pressed={same(category, c)}>
                {c} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
        {subcategories.length > 0 && (
          <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden" aria-label={`${category} types`}>
            <span className="shrink-0 pl-1 text-[13px] font-extrabold text-sea-muted" aria-hidden>
              ›
            </span>
            <button className={subChip(!subcategory)} onClick={() => setParams({ sub: "", type: "" })}>
              All {category}
            </button>
            {subcategories.map(([c, n]) => (
              <button key={c} className={subChip(same(subcategory, c))} onClick={() => setParams({ sub: c, type: "" })} aria-pressed={same(subcategory, c)}>
                {c} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
        {subsubs.length > 0 && (
          <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden" aria-label={`${subcategory} types`}>
            <span className="shrink-0 pl-5 text-[13px] font-extrabold text-sea-muted" aria-hidden>
              ››
            </span>
            <button className={subChip(!subsub)} onClick={() => setParam("type", "")}>
              All {subcategory}
            </button>
            {subsubs.map(([c, n]) => (
              <button key={c} className={subChip(same(subsub, c))} onClick={() => setParam("type", c)} aria-pressed={same(subsub, c)}>
                {c} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mb-5 text-[13px] font-semibold text-sea-muted" aria-live="polite">
        {shown.length} product{shown.length === 1 ? "" : "s"}
        {category && ` in ${category}`}
        {subcategory && ` › ${subcategory}`}
        {subsub && ` › ${subsub}`}
        {brand && ` · ${brand}`}
        {show && (
          <button
            type="button"
            onClick={() => setParam("show", "")}
            className="ml-2 inline-flex items-center gap-1 rounded-full bg-sea-teal-soft px-2.5 py-0.5 align-middle text-[12.5px] font-bold text-sea-teal hover:bg-sea-teal/15"
            aria-label={`Show all products, not only ${show === "sale" ? "those on sale" : "featured ones"}`}
          >
            {show === "sale" ? "On sale" : "Featured"} <X className="size-3.5" />
          </button>
        )}
      </p>

      {shown.length ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {shown.slice(0, n).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          {n < shown.length && (
            <div className="mt-10 flex justify-center">
              <a
                ref={end}
                href={allHref}
                onClick={(e) => {
                  e.preventDefault();
                  showMore();
                }}
                className="rounded-full border border-sea-line bg-sea-paper px-5 py-2.5 text-[14px] font-bold text-sea-body transition hover:border-sea-ink"
              >
                Show more products ({shown.length - n} more)
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="grid place-items-center rounded-[28px] border border-dashed border-sea-line px-6 py-20 text-center">
          <SearchX className="size-9 text-sea-muted" />
          <p className="mt-4 font-serif text-[24px]">Nothing found</p>
          <p className="mt-1 text-[14px] text-sea-muted">{products.length ? "Try another word or category." : "Products will appear here soon."}</p>
          {(q || category || brand || inStockOnly) && (
            <button
              onClick={() => {
                setQ("");
                setInStockOnly(false);
                setParams({ category: "", sub: "", type: "", brand: "" });
              }}
              className="mt-5 text-[14px] font-bold text-sea-teal underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  );
}
