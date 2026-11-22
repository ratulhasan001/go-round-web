"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { productPath } from "@/lib/seo";
import { linksFor, type CardProduct, type Links, type PublicProduct, type PublicShop, type PublicVariant } from "@/lib/site";
import type { SiteSettings } from "@/lib/types";

export interface CartLine {
  id: string; // the product's id, or "<product id>~<variant id>" for one of its variants
  pid?: string; // the product, for a variant's line
  variant?: string; // the variant's id
  product?: string; // the product's own name, for a variant's line (its page address is made from it)
  name: string; // with the variant, e.g. "APT Zero - 500 ml"
  price: number;
  unit: string;
  image?: string;
  qty: number;
  weight?: number; // kg per item, for the delivery charge
}

interface Ctx {
  shop: PublicShop;
  links: Links; // store / verify links for the address this page is on
  online: boolean; // false = no database: browsing works, ordering doesn't
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  /** Adds a product - or, for a product sold in variants, the variant the customer picked. */
  add: (p: CardProduct, qty?: number, variant?: PublicVariant) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Brings names, prices and stock up to date; returns the ids that are no longer for sale. */
  refresh: (products: PublicProduct[]) => string[];
  /** The little "added" sheet. */
  added: { name: string; at: number } | null;
  dismissAdded: () => void;
  /** The cart panel that slides in from the right (the cart button opens it instead of going to the cart page). */
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** The admin panel's live preview shows its own (unsaved) settings instead of the saved ones. */
  setPreviewSite: (site: SiteSettings | null) => void;
}

const C = createContext<Ctx | null>(null);
const KEY = "go-round-cart:v1";

/** A cart line's id: the product's, or the product's and its variant's together. */
export const lineId = (pid: string, variant?: string) => (variant ? `${pid}~${variant}` : pid);
/** The line's product page, with its variant picked. */
export const lineHref = (l: CartLine) =>
  l.pid ? `${productPath({ id: l.pid, name: l.product ?? l.name })}?v=${encodeURIComponent(l.variant ?? "")}` : productPath(l);
/** What the line is for the shop: the product and (when it has one) the variant. */
export const lineItem = (l: CartLine) => ({ id: l.pid ?? l.id, ...(l.variant ? { variant: l.variant } : {}), qty: l.qty });

export function StoreProvider({ shop: saved, online, host, children }: { shop: PublicShop; online: boolean; host: string; children: React.ReactNode }) {
  const [previewSite, setPreviewSite] = useState<SiteSettings | null>(null);
  const shop = useMemo(() => (previewSite ? { ...saved, site: previewSite } : saved), [saved, previewSite]);
  const links = useMemo(() => linksFor(host), [host]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [added, setAdded] = useState<Ctx["added"]>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = useCallback(() => {
    setAdded(null);
    setCartOpen(true);
  }, []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(saved)) setLines(saved.filter((l) => l && typeof l.id === "string" && l.qty > 0)); // eslint-disable-line react-hooks/set-state-in-effect -- read once from this browser
    } catch {
      /* private mode / bad data */
    }
    setReady(true);
    // another tab changed the cart
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        setLines(JSON.parse(e.newValue ?? "[]"));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* quota / private mode */
    }
  }, [lines, ready]);

  const add = useCallback((p: CardProduct, qty = 1, v?: PublicVariant) => {
    const id = lineId(p.id, v?.id);
    const name = v ? `${p.name} - ${v.label}` : p.name;
    setLines((ls) => {
      const hit = ls.find((l) => l.id === id);
      const max = (v ? v.stock : p.stock) ?? 99;
      if (hit) return ls.map((l) => (l.id === id ? { ...l, qty: Math.min(99, max, l.qty + qty) } : l));
      const line: CartLine = { id, ...(v ? { pid: p.id, variant: v.id, product: p.name } : {}), name, price: v?.price ?? p.price, unit: v ? "" : p.unit, image: v?.image || p.images[0], weight: v?.weight ?? p.weight, qty: Math.min(99, max, qty) };
      return [...ls, line];
    });
    setAdded({ name, at: Date.now() });
  }, []);

  const refresh = useCallback((products: PublicProduct[]) => {
    const byId = new Map(products.map((p) => [p.id, p]));
    // products merged into another one since the line was saved are now its variants (they kept their ids)
    const byVariant = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, p] as const)));
    const gone: string[] = [];
    setLines((ls) => {
      const out: CartLine[] = [];
      for (const l of ls) {
        const pid = l.pid ?? l.id;
        const p = byId.get(pid) ?? byVariant.get(pid);
        const vid = byId.has(pid) ? (l.variant ?? (p?.variants.length ? pid : undefined)) : pid;
        const v = p && p.variants.length ? p.variants.find((x) => x.id === vid) : undefined;
        if (!p || (p.variants.length ? !v || !v.inStock : !p.inStock)) {
          gone.push(l.id);
          continue;
        }
        const id = lineId(p.id, v?.id);
        const same = out.find((x) => x.id === id);
        const stock = (v ? v.stock : p.stock) ?? 99;
        if (same) {
          same.qty = Math.min(99, stock, same.qty + l.qty);
          continue;
        }
        out.push({ ...l, id, ...(v ? { pid: p.id, variant: v.id, product: p.name } : { pid: undefined, variant: undefined, product: undefined }), name: v ? `${p.name} - ${v.label}` : p.name, price: v?.price ?? p.price, unit: v ? "" : p.unit, image: v?.image || p.images[0], weight: v?.weight ?? p.weight, qty: Math.min(l.qty, stock) });
      }
      return out;
    });
    return gone;
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      shop,
      links,
      online,
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.price, 0),
      add,
      setQty: (id, qty) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty: Math.min(99, qty) } : l)))),
      remove: (id) => setLines((ls) => ls.filter((l) => l.id !== id)),
      clear: () => setLines([]),
      refresh,
      added,
      dismissAdded: () => setAdded(null),
      cartOpen,
      openCart,
      closeCart,
      setPreviewSite,
    }),
    [shop, links, online, lines, ready, add, refresh, added, cartOpen, openCart, closeCart],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useShop() {
  const c = useContext(C);
  if (!c) throw new Error("useShop must be used inside the store layout");
  return c;
}

// orders placed on this browser, so Order status can fill itself in
const RECENT = "go-round-recent-orders";
export function rememberOrder(code: string, phone: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(RECENT) ?? "[]") as { code: string; phone: string }[]).filter((o) => o.code !== code);
    localStorage.setItem(RECENT, JSON.stringify([{ code, phone }, ...list].slice(0, 10)));
  } catch {
    /* ignore */
  }
}
export function recentOrders(): { code: string; phone: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? "[]");
  } catch {
    return [];
  }
}
