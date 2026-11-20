"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CouponCode, Customer, Employee, Invoice, Letter, Order, Product, Review, Shop } from "./types";
import { DEFAULT_SHOP, SEED_CUSTOMERS, SEED_INVOICES, SEED_PRODUCTS } from "./seed";
import { uid } from "./calc";
import { couponProblem, givenBy, normCode, usedBy } from "./coupons";
import { normPhone, phoneKey } from "./phone";
import { ADMIN_IDLE_MINUTES, isStorePath, type Area } from "./site";

const KEY = "go-round-receipts:v1"; // this device's copy of the data
const OUTBOX = "go-round-receipts:outbox"; // changes not yet confirmed by the server
const MIGRATED = "go-round-receipts:migrated"; // this device's old data has been moved to the database

interface Data {
  shop: Shop;
  products: Product[];
  customers: Customer[];
  coupons: CouponCode[];
  invoices: Invoice[];
  letters: Letter[];
  orders: Order[]; // from the customer website
  employees: Employee[]; // staff records
  reviews: Review[]; // product reviews (from the website or added by the shop)
}

/** "local" = no database configured (data lives in this browser); "cloud" = saved to the database. */
export type Mode = "loading" | "local" | "cloud";
export type SyncState = "idle" | "saving" | "offline";

interface Store extends Data {
  /** Receipts the server gave a new number (another device had taken theirs): id -> new number. */
  renumbered: Record<string, string>;
  ready: boolean;
  mode: Mode;
  sync: SyncState;
  authEnabled: boolean;
  setShop: (s: Shop) => void;
  setProducts: (p: Product[]) => void;
  setCustomers: (c: Customer[]) => void;
  setCoupons: (c: CouponCode[]) => void;
  setEmployees: (e: Employee[]) => void;
  setReviews: (r: Review[]) => void;
  /** Saves changes to a website order (status, payment check, notes…). */
  saveOrder: (o: Order) => void;
  deleteOrder: (id: string) => void;
  /** remember: also add / update the customer and products it uses (off for auto-saves while typing). */
  saveInvoice: (inv: Invoice, opts?: { remember?: boolean }) => Invoice;
  deleteInvoice: (id: string) => void;
  nextInvoiceNumber: () => string;
  saveLetter: (l: Letter) => Letter;
  deleteLetter: (id: string) => void;
  exportBackup: () => string;
  importBackup: (json: string) => void;
  resetAll: () => void;
  /** Logs out ("idle": the panel logs itself out after ADMIN_IDLE_MINUTES without use). */
  logout: (reason?: "idle") => Promise<void>;
  /** Pulls the latest data from the database (e.g. after a customer filled in a form), unless local changes are still being sent. */
  reload: () => void;
}

const seed = (): Data => ({
  shop: DEFAULT_SHOP,
  products: SEED_PRODUCTS,
  customers: SEED_CUSTOMERS,
  coupons: [],
  invoices: SEED_INVOICES,
  letters: [],
  orders: [],
  employees: [],
  reviews: [],
});

const Ctx = createContext<Store | null>(null);

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Keeps the coupon sheet in step with a receipt: a coupon code it uses gets marked as used by it, and one it
 * gives away as a gift gets marked as given to its customer. A coupon it no longer uses or gives (code changed,
 * switched between use and gift, receipt deleted) is released. A coupon used or given by another receipt is
 * left alone, and so is one the sheet says this receipt can't have (expired, given to someone else…).
 */
function linkCoupon(coupons: CouponCode[], inv: Invoice, deleted = false): CouponCode[] {
  // codes compare without spaces or case, the same way the receipt editor finds them
  const code = deleted ? "" : normCode(inv.coupon?.code ?? "");
  const gift = !!inv.coupon?.gift;
  return coupons.map((c) => {
    const ours = !!code && normCode(c.code) === code;
    return linkGift(linkUse(c, inv, ours && !gift), inv, ours && gift);
  });
}

function linkUse(c: CouponCode, inv: Invoice, uses: boolean): CouponCode {
  const mine = !!c.usedOn && usedBy(c, inv);
  // a coupon a website order took stays that order's while the order lasts (the server frees it if the order goes)
  const release = () => (c.usedOrderId ? { ...c, usedInvoice: undefined, usedInvoiceId: undefined, updatedAt: Date.now() } : { ...c, usedOn: "", usedInvoice: undefined, usedInvoiceId: undefined, updatedAt: Date.now() });
  if (uses && (!c.usedOn || mine)) {
    if (couponProblem(c, inv, inv.customer, inv.date)) return mine ? release() : c;
    if (!mine || c.usedOn !== inv.date || c.usedInvoice !== inv.number || c.usedInvoiceId !== inv.id)
      return { ...c, usedOn: inv.date, usedInvoice: inv.number, usedInvoiceId: inv.id, updatedAt: Date.now() };
    return c;
  }
  return mine ? release() : c;
}

/** A gift is only recorded once the receipt has a name or phone, and only on a coupon nobody has yet. */
function linkGift(c: CouponCode, inv: Invoice, gives: boolean): CouponCode {
  const mine = givenBy(c, inv);
  const name = inv.customer.name.trim();
  const phone = inv.customer.phone.trim() ? normPhone(inv.customer.phone) : "";
  if (gives && (name || phone)) {
    if (mine && c.name === name && c.phone === phone && c.givenInvoice === inv.number) return c;
    if (!mine && (c.name.trim() || c.phone.trim() || couponProblem(c, inv, inv.customer, inv.date, true))) return c;
    return { ...c, name, phone, givenInvoice: inv.number, givenInvoiceId: inv.id, updatedAt: Date.now() };
  }
  if (!mine) return c;
  // taken back: nobody's again - unless it's been used since, which keeps who had it
  const usedSince = !!c.usedOn && !usedBy(c, inv);
  return { ...c, ...(usedSince ? {} : { name: "", phone: "" }), givenInvoice: undefined, givenInvoiceId: undefined, updatedAt: Date.now() };
}

// the old "... Aquascaping ... Supplies" taglines (default or hand-typed) give way to the current default
const isOldTagline = (t: string) => /aquascaping/i.test(t);

const withDefaults = (shop?: Partial<Shop> | null): Shop => ({
  ...DEFAULT_SHOP,
  ...shop,
  tagline: shop?.tagline === undefined || isOldTagline(shop.tagline) ? DEFAULT_SHOP.tagline : shop.tagline,
  // shops saved before the shop had an email address pick up the default one
  email: shop?.email?.trim() || DEFAULT_SHOP.email,
  rates: {
    pay: { ...DEFAULT_SHOP.rates.pay, ...shop?.rates?.pay },
    courier: { ...DEFAULT_SHOP.rates.courier, ...shop?.rates?.courier },
  },
});

// ---------- document diffing (what changed since the last sync) ----------

type Kind = "shop" | "product" | "customer" | "coupon" | "invoice" | "letter" | "order" | "employee" | "review";
interface Change {
  kind: Kind;
  id: string;
  data: object | null; // null = deleted
}
const LISTS: [Kind, keyof Omit<Data, "shop">][] = [
  ["product", "products"],
  ["customer", "customers"],
  ["coupon", "coupons"],
  ["invoice", "invoices"],
  ["letter", "letters"],
  ["order", "orders"],
  ["employee", "employees"],
  ["review", "reviews"],
];

function docs(d: Data) {
  const m = new Map<string, Change>();
  m.set("shop:shop", { kind: "shop", id: "shop", data: d.shop });
  for (const [kind, list] of LISTS) for (const x of d[list] as { id: string }[]) m.set(`${kind}:${x.id}`, { kind, id: x.id, data: x });
  return m;
}

function diff(prev: Data, next: Data): Change[] {
  const a = docs(prev);
  const b = docs(next);
  const out: Change[] = [];
  for (const [k, c] of b) if (!a.has(k) || JSON.stringify(a.get(k)!.data) !== JSON.stringify(c.data)) out.push(c);
  for (const [k, c] of a) if (!b.has(k)) out.push({ ...c, data: null });
  return out;
}

function applyChanges(d: Data, changes: Change[]): Data {
  const next: Data = { ...d, products: [...d.products], customers: [...d.customers], coupons: [...d.coupons], invoices: [...d.invoices], letters: [...d.letters], orders: [...d.orders], employees: [...d.employees], reviews: [...d.reviews] };
  for (const c of changes) {
    if (c.kind === "shop") {
      if (c.data) next.shop = withDefaults(c.data as Shop);
      continue;
    }
    const list = LISTS.find(([k]) => k === c.kind)![1];
    const arr = (next[list] as { id: string }[]).filter((x) => x.id !== c.id);
    if (c.data) arr.unshift(c.data as { id: string });
    (next as unknown as Record<string, unknown>)[list] = arr;
  }
  return next;
}

const readJSON = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
};

/** The login page, coming back to this page afterwards (a session ends after a few hours). */
const loginAgain = () => `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;

/**
 * Deletes this device's copy of the shop's data. With the database it is never kept (the server has everything), so
 * nobody who gets at this browser later - after the login ends - can read the customers, receipts and orders out of
 * it. Changes not yet sent (OUTBOX) stay until they reach the server.
 */
export function forgetDeviceCopy() {
  try {
    if (localStorage.getItem(MIGRATED)) localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

// the last time the admin used the panel, shared by this browser's admin tabs (see the idle logout below)
const ACTIVE = "go-round-receipts:active";

export function StoreProvider({ area, children }: { area: Area; children: React.ReactNode }) {
  const path = usePathname();
  // the login page, the public customer form (/f/…) and the customer website never load the shop's data
  const offApp = area === "store" || area === "verify" || path === "/login" || path.startsWith("/login/") || path.startsWith("/f/") || isStorePath(path);
  const [data, setData] = useState<Data>(seed);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [sync, setSync] = useState<SyncState>("idle");
  const [authEnabled, setAuthEnabled] = useState(false);

  const lastSeen = useRef<Data | null>(null); // data as of the last diff
  const outbox = useRef(new Map<string, Change>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const edits = useRef(0); // bumps on every local change, so a slow reload can't put older data back

  const schedule = useRef<(ms: number) => void>(() => {});

  // When the first load failed and this device had no saved copy, the app is showing demo data: nothing may be sent
  // to the database from it (it would replace the real settings and records), until a load succeeds.
  const noBase = useRef(false);

  /**
   * A receipt number another device had already taken: the server gave this receipt the next free one. The local
   * copy (and the order and coupon pointing at it) take the new number; an open receipt editor reads `renumbered`.
   */
  const [renumbered, setRenumbered] = useState<Record<string, string>>({});
  const applyRenumbers = useCallback((list: { id: string; number: string }[]) => {
    if (!list.length) return;
    const to = new Map(list.map((r) => [r.id, r.number]));
    setRenumbered((m) => ({ ...m, ...Object.fromEntries(to) }));
    setData((d) => {
      const shop = { ...d.shop };
      for (const n of to.values()) {
        const k = n.startsWith(shop.invoicePrefix) ? Number(n.slice(shop.invoicePrefix.length)) : NaN;
        if (Number.isFinite(k) && k >= shop.nextNumber) shop.nextNumber = k + 1;
      }
      return {
        ...d,
        shop,
        invoices: d.invoices.map((i) => (to.has(i.id) ? { ...i, number: to.get(i.id)! } : i)),
        orders: d.orders.map((o) => (o.invoiceId && to.has(o.invoiceId) ? { ...o, invoiceNumber: to.get(o.invoiceId)! } : o)),
        coupons: d.coupons.map((c) => (c.usedInvoiceId && to.has(c.usedInvoiceId) ? { ...c, usedInvoice: to.get(c.usedInvoiceId)! } : c)),
      };
    });
  }, []);

  /** Sends one group of changes. "bad" = the server refuses them as they are (they will never go through). */
  const send = useCallback(async (changes: Change[]): Promise<"ok" | "bad" | "auth" | "retry"> => {
    const res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes }) }).catch(() => null);
    if (!res) return "retry";
    if (res.status === 401) return "auth";
    if (res.ok) {
      const b = (await res.json().catch(() => null)) as { renumbered?: { id: string; number: string }[] } | null;
      if (b?.renumbered?.length) applyRenumbers(b.renumbered);
      return "ok";
    }
    return res.status === 400 || res.status === 413 ? "bad" : "retry";
  }, [applyRenumbers]);

  const flush = useCallback(async () => {
    if (flushing.current || outbox.current.size === 0) return;
    flushing.current = true;
    const batch = [...outbox.current.entries()];
    setSync("saving");
    // small groups (by count and size), so one huge import or one broken record can't block everything else
    const groups: [string, Change][][] = [];
    let cur: [string, Change][] = [];
    let size = 0;
    for (const e of batch) {
      const n = JSON.stringify(e[1]).length;
      if (cur.length && (cur.length >= 200 || size + n > 2_500_000)) {
        groups.push(cur);
        cur = [];
        size = 0;
      }
      cur.push(e);
      size += n;
    }
    if (cur.length) groups.push(cur);

    const done = (entries: [string, Change][]) => {
      for (const [k, c] of entries) if (outbox.current.get(k) === c) outbox.current.delete(k); // unless it changed again meanwhile
    };
    let retry = false;
    try {
      const todo = [...groups];
      while (todo.length) {
        const g = todo.shift()!;
        const r = await send(g.map(([, c]) => c));
        if (r === "auth") {
          flushing.current = false;
          window.location.href = loginAgain(); // full reload clears the session state
          return;
        }
        if (r === "ok") done(g);
        else if (r === "bad") {
          // find the record the server won't take: split the group; a single refused record is dropped (kept on this device)
          if (g.length > 1) todo.unshift(g.slice(0, Math.ceil(g.length / 2)), g.slice(Math.ceil(g.length / 2)));
          else {
            console.error("A change was refused by the server and won't be retried", g[0]![1]);
            done(g);
          }
        } else {
          retry = true;
          break;
        }
      }
    } catch {
      retry = true;
    }
    writeJSON(OUTBOX, [...outbox.current.values()]);
    flushing.current = false;
    if (retry) {
      setSync("offline");
      schedule.current(10_000); // retry until the connection is back
      return;
    }
    setSync("idle");
    if (outbox.current.size) schedule.current(400); // more changes arrived while saving
  }, [send]);

  useEffect(() => {
    schedule.current = (ms: number) => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        void flush();
      }, ms);
    };
  }, [flush]);

  const queue = useCallback(
    (changes: Change[]) => {
      if (!changes.length || noBase.current) return;
      for (const c of changes) outbox.current.set(`${c.kind}:${c.id}`, c);
      writeJSON(OUTBOX, [...outbox.current.values()]);
      schedule.current(600);
    },
    [],
  );

  const loadFromServer = useCallback(async (): Promise<"ok" | "nodb" | "failed"> => {
    const startedAt = edits.current;
    const res = await fetch("/api/data", { cache: "no-store" }).catch(() => null);
    if (res?.status === 401) {
      window.location.href = loginAgain(); // full reload clears the session state
      return "failed";
    }
    const body = res?.ok ? await res.json().catch(() => null) : null;
    if (!body) return "failed";
    // something was changed on this device while loading: keep it (the next reload picks up the server copy)
    if (edits.current !== startedAt) return "ok";
    setAuthEnabled(!!body.auth);
    if (!body.db) return "nodb";

    const server: Data = {
      shop: withDefaults(body.shop),
      products: body.products ?? [],
      customers: body.customers ?? [],
      coupons: body.coupons ?? [],
      invoices: body.invoices ?? [],
      letters: body.letters ?? [],
      orders: body.orders ?? [],
      employees: body.employees ?? [],
      reviews: body.reviews ?? [],
    };
    const pending: Change[] = [];
    let merged = server;
    const local = readJSON<Partial<Data>>(KEY);

    if (!localStorage.getItem(MIGRATED)) {
      const serverEmpty = !body.shop && !server.products.length && !server.customers.length && !server.invoices.length && !server.letters.length;
      if (local) {
        // first login on a device that already has receipts: move them into the database
        // (but not the untouched demo receipt / customer this device started with)
        const localData: Data = { ...seed(), ...local, shop: withDefaults(local.shop) };
        const have = docs(server);
        const demo = docs(seed());
        const same = (k: string, c: Change) => k !== "shop:shop" && JSON.stringify(demo.get(k)?.data) === JSON.stringify(c.data);
        for (const [k, c] of docs(localData)) if ((!have.has(k) || (k === "shop:shop" && !body.shop)) && !same(k, c)) pending.push(c);
      }
      if (serverEmpty && pending.every((c) => c.kind === "shop")) {
        // brand-new shop: start with the default settings and product list (keeping this device's settings, if any)
        const starter = docs({ shop: DEFAULT_SHOP, products: SEED_PRODUCTS, customers: [], coupons: [], invoices: [], letters: [], orders: [], employees: [], reviews: [] });
        pending.unshift(...[...starter.values()].filter((c) => !pending.some((p) => p.kind === c.kind)));
      }
      merged = applyChanges(server, pending);
      localStorage.setItem(MIGRATED, "1");
    } else if (!body.shop) {
      pending.push({ kind: "shop", id: "shop", data: server.shop });
    }

    // changes made on this device that never reached the server
    const unsent = readJSON<Change[]>(OUTBOX) ?? [];
    merged = applyChanges(merged, unsent);
    pending.push(...unsent);

    noBase.current = false; // the real data is here now
    lastSeen.current = merged;
    setData(merged);
    queue(pending);
    return "ok";
  }, [queue]);

  // initial load
  useEffect(() => {
    if (offApp) return;
    let cancelled = false;
    (async () => {
      const local = readJSON<Partial<Data>>(KEY);
      const result = await loadFromServer();
      if (cancelled) return;
      if (result === "ok") setMode("cloud");
      else {
        // no database (or it can't be reached): keep working from this device's copy
        const wasCloud = !!localStorage.getItem(MIGRATED) && result === "failed";
        // with the database there's no copy on this device any more: show nothing rather than the demo receipts
        const empty: Data = { ...seed(), products: [], customers: [], coupons: [], invoices: [], letters: [], orders: [], employees: [], reviews: [] };
        const fromLocal = local ? { ...seed(), ...local, shop: withDefaults(local.shop) } : wasCloud ? empty : seed();
        lastSeen.current = fromLocal;
        setData(fromLocal);
        setMode(wasCloud ? "cloud" : "local");
        if (wasCloud) {
          setSync("offline");
          for (const c of readJSON<Change[]>(OUTBOX) ?? []) outbox.current.set(`${c.kind}:${c.id}`, c);
          schedule.current(10_000);
          if (!local) {
            // no copy on this device (e.g. after logging out): what's on screen is demo data - never save it over the
            // real records; keep trying to load them instead
            noBase.current = true;
            const retry = setInterval(() => {
              void loadFromServer().then((r) => r === "ok" && clearInterval(retry));
            }, 10_000);
          }
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [offApp, loadFromServer]);

  // keep this device's copy (only without a database - see forgetDeviceCopy), and queue changes for the database
  useEffect(() => {
    if (!ready) return;
    if (mode === "local") writeJSON(KEY, data);
    else forgetDeviceCopy();
    if (mode === "cloud" && lastSeen.current) {
      const changes = diff(lastSeen.current, data);
      if (changes.length) edits.current++;
      queue(changes);
    }
    lastSeen.current = data;
  }, [data, ready, mode, queue]);

  // pick up changes made on other devices when coming back to the app
  useEffect(() => {
    if (mode !== "cloud") return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && outbox.current.size === 0 && !flushing.current) void loadFromServer();
    };
    document.addEventListener("visibilitychange", onVisible);
    // and look for new website orders every minute while the app is open
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && outbox.current.size === 0 && !flushing.current) void loadFromServer();
    }, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [mode, loadFromServer]);

  const nextInvoiceNumber = useCallback(() => {
    const used = new Set(data.invoices.map((i) => i.number));
    let n = data.shop.nextNumber;
    let num = `${data.shop.invoicePrefix}${String(n).padStart(4, "0")}`;
    while (used.has(num)) num = `${data.shop.invoicePrefix}${String(++n).padStart(4, "0")}`;
    return num;
  }, [data.invoices, data.shop]);

  const saveInvoice = useCallback((inv: Invoice, { remember = true }: { remember?: boolean } = {}) => {
    const saved = { ...inv, updatedAt: Date.now() };
    setData((d) => {
      const exists = d.invoices.some((i) => i.id === inv.id);
      const invoices = exists ? d.invoices.map((i) => (i.id === inv.id ? saved : i)) : [saved, ...d.invoices];

      // bump the running number when a new invoice uses it
      const shop = { ...d.shop };
      const m = inv.number.startsWith(shop.invoicePrefix) ? Number(inv.number.slice(shop.invoicePrefix.length)) : NaN;
      if (!exists && Number.isFinite(m) && m >= shop.nextNumber) shop.nextNumber = m + 1;

      // remember new / updated customers automatically
      let customers = d.customers;
      const c = inv.customer;
      if (remember && c.name.trim()) {
        // the same person is the same phone number; a name alone only matches when one side has no number
        const key = phoneKey(c.phone);
        const byName = customers.find((x) => norm(x.name) === norm(c.name));
        const hit = (key ? customers.find((x) => phoneKey(x.phone) === key) : undefined) ?? (byName && (!key || !phoneKey(byName.phone)) ? byName : undefined);
        if (!hit) customers = [...customers, { id: uid(), name: c.name.trim(), phone: c.phone, address: c.address, updatedAt: Date.now() }];
        else if (hit.phone !== c.phone || hit.address !== c.address)
          customers = customers.map((x) =>
            x.id === hit.id ? { ...x, phone: c.phone || x.phone, address: c.address || x.address, updatedAt: Date.now() } : x,
          );
      }

      // remember new products automatically
      let products = d.products;
      for (const it of remember ? inv.items : []) {
        if (!it.description.trim() || !it.price) continue;
        if (!products.some((p) => norm(p.name) === norm(it.description)))
          products = [...products, { id: uid(), name: it.description.trim(), price: Number(it.price), inStock: true, updatedAt: Date.now() }];
      }
      // a receipt made from a website order is linked to it
      const orders = inv.orderId
        ? d.orders.map((o) => (o.id === inv.orderId && (o.invoiceId !== saved.id || o.invoiceNumber !== saved.number) ? { ...o, invoiceId: saved.id, invoiceNumber: saved.number, updatedAt: Date.now() } : o))
        : d.orders;
      return { ...d, invoices, shop, customers, products, orders, coupons: linkCoupon(d.coupons, saved) };
    });
    return saved;
  }, []);

  const leaving = useRef(false);
  const logout = useCallback(async (reason?: "idle") => {
    if (leaving.current) return;
    leaving.current = true;
    await fetch("/api/logout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) }).catch(() => null);
    forgetDeviceCopy(); // no shop data left on a logged-out device (unsent changes stay in OUTBOX)
    window.location.href = reason === "idle" ? `${loginAgain()}&idle=1` : "/login"; // full reload clears the session state
  }, []);

  // Log out after ADMIN_IDLE_MINUTES without the admin touching the panel in any tab of this browser - so a laptop left
  // open doesn't stay logged in. (The server also ends a session after that long without requests, for a closed tab
  // or a sleeping computer.) Idleness is checked before new activity counts: moving the mouse on a computer waking up
  // after an hour must log out, not extend the session.
  useEffect(() => {
    if (offApp || !authEnabled) return;
    const limit = ADMIN_IDLE_MINUTES * 60_000;
    let marked = Date.now();
    const lastUse = () => {
      let shared = 0;
      try {
        shared = Number(localStorage.getItem(ACTIVE)) || 0;
      } catch {
        /* private mode */
      }
      return Math.max(shared, marked);
    };
    const save = () => {
      try {
        localStorage.setItem(ACTIVE, String(marked));
      } catch {
        /* private mode */
      }
    };
    const check = () => {
      if (Date.now() - lastUse() > limit) void logout("idle");
    };
    const used = () => {
      const now = Date.now();
      if (now - lastUse() > limit) return void logout("idle");
      if (now - marked < 10_000) return; // remember it at most every 10 seconds
      marked = now;
      save();
    };
    save(); // opening a page of the panel counts as using it
    const kinds = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const k of kinds) window.addEventListener(k, used, { passive: true, capture: true });
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 30_000);
    return () => {
      for (const k of kinds) window.removeEventListener(k, used, { capture: true });
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      clearInterval(timer);
    };
  }, [offApp, authEnabled, logout]);

  const store = useMemo<Store>(
    () => ({
      renumbered,
      ...data,
      ready,
      mode,
      sync,
      authEnabled,
      setShop: (shop) => setData((d) => ({ ...d, shop })),
      setProducts: (products) => setData((d) => ({ ...d, products })),
      setCustomers: (customers) => setData((d) => ({ ...d, customers })),
      setCoupons: (coupons) => setData((d) => ({ ...d, coupons })),
      setEmployees: (employees) => setData((d) => ({ ...d, employees })),
      setReviews: (reviews) => setData((d) => ({ ...d, reviews })),
      saveOrder: (o) => setData((d) => ({ ...d, orders: d.orders.map((x) => (x.id === o.id ? { ...o, updatedAt: Date.now() } : x)) })),
      deleteOrder: (id) =>
        setData((d) => ({
          ...d,
          orders: d.orders.filter((o) => o.id !== id),
          // its receipt stays, just no longer linked to a website order
          invoices: d.invoices.map((i) => (i.orderId === id ? { ...i, orderId: undefined } : i)),
        })),
      saveInvoice,
      deleteInvoice: (id) =>
        setData((d) => {
          const inv = d.invoices.find((i) => i.id === id);
          // deleting the newest receipt frees its number, so the next new receipt reuses it
          let shop = d.shop;
          const m = inv?.number.startsWith(shop.invoicePrefix) ? Number(inv.number.slice(shop.invoicePrefix.length)) : NaN;
          if (m >= 1 && m === shop.nextNumber - 1) shop = { ...shop, nextNumber: m };
          // a website order made into this receipt no longer has one
          const orders = d.orders.map((o) => (o.invoiceId === id ? { ...o, invoiceId: undefined, invoiceNumber: undefined, updatedAt: Date.now() } : o));
          return { ...d, shop, orders, invoices: d.invoices.filter((i) => i.id !== id), coupons: inv ? linkCoupon(d.coupons, inv, true) : d.coupons };
        }),
      nextInvoiceNumber,
      saveLetter: (l) => {
        const saved = { ...l, createdAt: l.createdAt ?? Date.now(), updatedAt: Date.now() };
        setData((d) => ({
          ...d,
          letters: d.letters.some((x) => x.id === l.id) ? d.letters.map((x) => (x.id === l.id ? saved : x)) : [saved, ...d.letters],
        }));
        return saved;
      },
      deleteLetter: (id) => setData((d) => ({ ...d, letters: d.letters.filter((l) => l.id !== id) })),
      exportBackup: () => JSON.stringify({ app: "go-round-receipts", version: 1, ...data }, null, 2),
      importBackup: (json) => {
        const parsed = JSON.parse(json);
        if (!parsed || !Array.isArray(parsed.invoices)) throw new Error("This file is not a Go Round backup.");
        setData({
          shop: withDefaults(parsed.shop),
          products: parsed.products ?? [],
          customers: parsed.customers ?? [],
          coupons: parsed.coupons ?? [],
          invoices: parsed.invoices,
          letters: parsed.letters ?? [],
          orders: parsed.orders ?? [],
          employees: parsed.employees ?? [],
          reviews: parsed.reviews ?? [],
        });
      },
      resetAll: () => setData(seed()),
      logout,
      reload: () => {
        if (mode === "cloud" && outbox.current.size === 0 && !flushing.current) void loadFromServer();
      },
    }),
    [data, ready, mode, sync, authEnabled, saveInvoice, nextInvoiceNumber, logout, loadFromServer, renumbered],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
