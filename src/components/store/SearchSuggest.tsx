"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Search, Tag, X } from "lucide-react";
import { tk, type CardProduct } from "@/lib/site";
import { productPath } from "@/lib/seo";
import { ProductImage } from "./ProductImage";
import { useShop } from "./StoreContext";
import { btn, cx } from "./ui";

/** The header's search icon: an event when the products page is already open, a sessionStorage flag when it's opening. */
export const FOCUS_SEARCH = "gr-focus-search";

const MAX_PRODUCTS = 6;
const MAX_GROUPS = 3;

/** A product the box can suggest. The shop page also passes its SKUs and description text; the home page doesn't. */
type Suggestable = CardProduct & { sku?: string; text?: string };

type Pick =
  | { kind: "product"; p: Suggestable }
  | { kind: "category"; name: string; n: number }
  | { kind: "brand"; name: string; n: number };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How well a product fits the words typed: 0 = not at all; higher is better, with name matches first. */
function score(p: Suggestable, words: string[]) {
  const name = p.name.toLowerCase();
  const all = `${name} ${p.brand} ${p.sku ?? ""} ${p.category} ${p.subcategory} ${p.subsubcategory} ${p.text ?? ""}`.toLowerCase();
  if (!words.every((w) => all.includes(w))) return 0;
  const phrase = words.join(" ");
  let s = 1;
  if (name.startsWith(phrase)) s += 8;
  else if (name.includes(phrase)) s += 5;
  for (const w of words) {
    if (new RegExp(`(^|[^a-z0-9])${escape(w)}`).test(name)) s += 2;
    else if (name.includes(w)) s += 1;
  }
  return s + (p.inStock ? 0.5 : 0);
}

/**
 * A search box with suggestions under it while typing: matching categories and brands, then matching products (photo,
 * name, price) that open straight away. Arrow keys move, Enter picks, Esc closes.
 * - "bar", the shop page's own box: the list under it filters as you type, and a category or brand filters it.
 * - "hero", the home page's box: a GET form to the shop page (works without scripts too); a category or brand opens the
 *   shop page filtered, and Enter with nothing highlighted searches the shop for the words typed.
 */
export function SearchSuggest({
  products,
  variant = "bar",
  value: controlled,
  onChange,
  onCategory,
  onBrand,
  action,
  className,
}: {
  products: Suggestable[];
  variant?: "bar" | "hero";
  value?: string;
  onChange?: (q: string) => void;
  onCategory?: (c: string) => void;
  onBrand?: (b: string) => void;
  /** hero: the shop page's address */
  action?: string;
  className?: string;
}) {
  const router = useRouter();
  const { links } = useShop();
  const id = useId();
  const [own, setOwn] = useState("");
  const value = controlled ?? own;
  const setValue = onChange ?? setOwn;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const shopPage = action ?? links.store("/products");

  // the header's search icon (only the shop page's box answers it)
  useEffect(() => {
    if (variant !== "bar") return;
    const focus = () => {
      const el = input.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
      // the search bar sticks under the header, so bring it to the top of the list it searches
      el.closest("[data-shop-bar]")?.scrollIntoView({ block: "nearest" });
      setOpen(true);
    };
    try {
      if (sessionStorage.getItem(FOCUS_SEARCH)) {
        sessionStorage.removeItem(FOCUS_SEARCH);
        focus();
      }
    } catch {
      /* private mode */
    }
    window.addEventListener(FOCUS_SEARCH, focus);
    return () => window.removeEventListener(FOCUS_SEARCH, focus);
  }, [variant]);

  const picks = useMemo<Pick[]>(() => {
    const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const has = (s: string) => words.every((w) => s.toLowerCase().includes(w));
    const groups = (key: "category" | "brand") => {
      const m = new Map<string, number>();
      for (const p of products) if (p[key] && has(p[key])) m.set(p[key], (m.get(p[key]) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_GROUPS);
    };
    const found = products
      .map((p) => ({ p, s: score(p, words) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
      .slice(0, MAX_PRODUCTS);
    return [
      ...groups("category").map(([name, n]) => ({ kind: "category" as const, name, n })),
      ...groups("brand").map(([name, n]) => ({ kind: "brand" as const, name, n })),
      ...found.map(({ p }) => ({ kind: "product" as const, p })),
    ];
  }, [value, products]);

  const show = open && picks.length > 0;
  const firstProduct = picks.findIndex((k) => k.kind === "product");

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const choose = (k: Pick) => {
    close();
    if (k.kind === "product") return router.push(links.store(productPath(k.p)));
    const on = k.kind === "category" ? onCategory : onBrand;
    if (on) {
      setValue("");
      on(k.name);
    } else router.push(`${shopPage}?${k.kind}=${encodeURIComponent(k.name)}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown" && picks.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % picks.length);
    } else if (e.key === "ArrowUp" && picks.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? picks.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (show && active >= 0 && picks[active]) {
        e.preventDefault();
        choose(picks[active]);
      } else if (variant === "bar") {
        // nothing highlighted: keep the typed search and show the list under it
        close();
        e.currentTarget.blur();
      }
      // hero: the form sends the words to the shop page
    }
  };

  const field = (
    <input
      ref={input}
      name={variant === "hero" ? "q" : undefined}
      required={variant === "hero"}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setOpen(true);
        setActive(-1);
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKey}
      placeholder="Search plants, ferts, tools…"
      aria-label="Search products"
      type="search"
      role="combobox"
      aria-expanded={show}
      aria-controls={`${id}-list`}
      aria-autocomplete="list"
      aria-activedescendant={show && active >= 0 ? `${id}-${active}` : undefined}
      autoComplete="off"
      className={cx(
        "[&::-webkit-search-cancel-button]:appearance-none",
        variant === "hero"
          ? "h-10 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-sea-ink outline-none placeholder:font-normal placeholder:text-sea-muted/80"
          : "h-11 w-full rounded-full border border-sea-line bg-white pl-11 pr-10 text-[15px] font-medium outline-none transition placeholder:font-normal placeholder:text-sea-muted/70 focus:border-sea-teal focus:ring-4 focus:ring-sea-teal/12",
      )}
    />
  );

  const list = show && (
    <ul
      id={`${id}-list`}
      role="listbox"
      aria-label="Search suggestions"
      className={cx(
        "absolute top-[calc(100%+8px)] z-30 overflow-y-auto overscroll-contain rounded-[20px] border border-sea-line bg-white p-1.5 text-left shadow-[0_18px_40px_-12px_rgba(16,42,40,0.28)]",
        variant === "hero" ? "inset-x-0 max-h-[min(60vh,420px)]" : "inset-x-0 max-h-[min(70vh,460px)] md:right-auto md:w-[26rem]",
      )}
    >
      {picks.map((k, i) => (
        <li
          key={k.kind === "product" ? k.p.id : `${k.kind}:${k.name}`}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          // mousedown, not click: the input's blur would close the list first
          onMouseDown={(e) => {
            e.preventDefault();
            choose(k);
          }}
          onMouseEnter={() => setActive(i)}
          className={cx(
            "flex cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-[14px]",
            i === active ? "bg-sea-teal-soft" : "hover:bg-sea-sand/60",
            i === firstProduct && i > 0 && "mt-1 border-t border-sea-line/70 pt-2.5",
          )}
        >
          {k.kind === "product" ? (
            <>
              <span className={cx("size-11 shrink-0 overflow-hidden rounded-[10px] bg-sea-sand ring-1 ring-sea-line", !k.p.inStock && "opacity-60")}>
                <ProductImage src={k.p.images[0]} name={k.p.name} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-sea-ink">{k.p.name}</span>
                <span className="block truncate text-[12px] text-sea-muted">
                  {[k.p.brand, k.p.category].filter(Boolean).join(" · ")}
                  {!k.p.inStock && " · Sold out"}
                </span>
              </span>
              <span className="shrink-0 text-[13.5px] font-bold text-sea-ink">
                {k.p.priceTo > k.p.price && <span className="text-[11.5px] font-semibold text-sea-muted">From </span>}
                {tk(k.p.price)}
              </span>
            </>
          ) : (
            <>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sea-teal-soft text-sea-teal">
                {k.kind === "category" ? <Layers className="size-4" /> : <Tag className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-sea-ink">{k.name}</span>
                <span className="text-sea-muted"> {k.kind}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-sea-muted">{k.n}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );

  const onBlur = (e: React.FocusEvent) => {
    if (!box.current?.contains(e.relatedTarget as Node)) close();
  };

  if (variant === "hero")
    return (
      <div ref={box} onBlur={onBlur} className={cx("relative z-20 max-w-md", className)}>
        <form
          action={shopPage}
          method="get"
          role="search"
          className="flex items-center gap-2 rounded-full border border-sea-line bg-white p-1.5 pl-5 shadow-[0_14px_30px_-22px_rgba(17,58,45,0.6)] focus-within:border-sea-teal focus-within:ring-4 focus-within:ring-sea-teal/12"
        >
          <Search className="size-[18px] shrink-0 text-sea-muted" aria-hidden />
          {field}
          <button type="submit" className={btn("teal", "sm", "h-10 shrink-0")}>
            <Search className="size-4" /> Search
          </button>
        </form>
        {list}
      </div>
    );

  return (
    <div ref={box} onBlur={onBlur} className={cx("relative md:w-80", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-sea-muted" />
      {field}
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            close();
          }}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-sea-muted hover:bg-sea-sand"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
      {list}
    </div>
  );
}
