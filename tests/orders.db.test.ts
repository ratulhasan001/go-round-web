// Website orders against a real Postgres: prices, stock and coupons are taken in the database the way the live shop
// does it. Runs only with TEST_DATABASE_URL pointing at a throwaway local database (GitHub's CI starts one), because
// every run wipes the gr_* tables first.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CouponCode, Order, Product } from "@/lib/types";

const url = process.env.TEST_DATABASE_URL ?? "";
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!url)("website orders in the database", () => {
  // loaded once the database address is set (they read it when first used)
  let m: {
    db: typeof import("@/lib/server/db");
    orders: typeof import("@/lib/server/orders");
  };
  const sql = () => m.db.db();
  const product = async (id: string) => (await sql()<{ data: Product }[]>`select data from gr_docs where kind = 'product' and id = ${id}`)[0]!.data;
  const coupon = async () => (await sql()<{ data: CouponCode }[]>`select data from gr_docs where kind = 'coupon' and id = 'c1'`)[0]!.data;
  const setStock = (id: string, stock: number | null) =>
    sql()`update gr_docs set data = jsonb_set(data, '{stock}', ${stock === null ? sql().json(null as never) : sql().json(stock as never)}) || '{"inStock": true}' where kind = 'product' and id = ${id}`;

  const checkout = (over: Record<string, unknown> = {}) => ({
    name: "Rahim Uddin",
    phone: "01712345678",
    address: "House 1, Road 2, Mirpur",
    ps: "Mirpur",
    zone: "sf-in-express",
    method: "bKash",
    trxId: "ABC12345",
    accept: true,
    items: [{ id: "p1", qty: 2, price: 1 }, { id: "p2", qty: 1 }], // the price sent by the browser is ignored
    ...over,
  });
  /** What placing this order is refused with (status and body), or null when it goes through. */
  const refusal = async (body: Record<string, unknown>) => {
    try {
      await m.orders.placeOrder(body, null);
      return null;
    } catch (e) {
      if (e instanceof m.orders.OrderError) return { status: e.status, ...e.body };
      throw e;
    }
  };
  /** The admin panel saving an order with a new status (or deleting it), as /api/sync does. */
  const saveOrder = (before: Order, after: Order | null) =>
    sql().begin(async (tx) => {
      await m.orders.stockForOrderChange(tx, before, after);
      await m.orders.couponForOrderChange(tx, before, after);
    });

  beforeAll(async () => {
    if (!local) throw new Error("TEST_DATABASE_URL must be a local throwaway database - these tests wipe it");
    process.env.DATABASE_URL = url;
    m = { db: await import("@/lib/server/db"), orders: await import("@/lib/server/orders") };
    const tables = await sql()<{ t: string }[]>`select tablename as t from pg_tables where schemaname = 'public' and tablename like 'gr\\_%'`;
    for (const { t } of tables) await sql().unsafe(`drop table ${t} cascade`);
    await m.db.ensureSchema();
    const doc = (kind: string, id: string, data: object) => sql()`insert into gr_docs (kind, id, data) values (${kind}, ${id}, ${sql().json(data as never)})`;
    await doc("shop", "shop", { name: "Go Round", phone: "01309372143", site: { open: true } });
    await doc("product", "p1", { id: "p1", name: "Anubias nana", price: 450, stock: 5, weight: 0.5, onSite: true, images: [] });
    await doc("product", "p2", { id: "p2", name: "Seachem Prime", price: 1200, weight: 1.2, onSite: true, images: [] }); // stock not counted
    await doc("product", "p3", { id: "p3", name: "Sold-out moss", price: 100, stock: 0, onSite: true, images: [] });
    // sold in variants: "pv" kept its own id as its 200 ml variant; "old500" was a product merged into it
    await doc("product", "pv", {
      id: "pv",
      name: "APT Zero",
      price: 1499,
      onSite: true,
      images: ["/api/img/zero"],
      variants: [
        { id: "pv", kind: "ml", amount: 200, price: 1499, stock: 3, weight: 0.3 },
        { id: "v300", kind: "ml", amount: 300, price: 2249, inStock: false },
        { id: "old500", kind: "ml", amount: 500, price: 2699, regularPrice: 2800, weight: 0.6, image: "/api/img/zero500" },
      ],
    });
    await doc("product", "pw", { id: "pw", name: "Bog wood - 1 kg", price: 2199, onSite: true, images: [], variants: [{ id: "w1", kind: "size", size: "large", price: 2199, stock: 1 }] });
    await doc("product", "pc", { id: "pc", name: "Moss ball", price: 150, onSite: true, images: [], variants: [{ id: "c3", kind: "custom", name: "Pack of 3", price: 400, stock: 2 }] });
    await doc("coupon", "c1", { id: "c1", code: "GR10-OFF", name: "", phone: "+8801712345678", pct: 10, validFrom: "2020-01-01", validTo: "2099-12-31" });
  });

  afterAll(async () => {
    if (m) await sql().end();
  });

  let first: Order;

  it("prices the order from the database: items, weight-based delivery and the coupon", async () => {
    first = await m.orders.placeOrder(checkout({ coupon: " gr10-off " }), null);
    expect(first.items.map((i) => [i.productId, i.price, i.qty])).toEqual([["p1", 450, 2], ["p2", 1200, 1]]);
    expect(first.subtotal).toBe(2100); // 2 × 450 + 1200
    expect(first.weight).toBe(2.2); // 2 × 0.5 + 1.2 kg
    expect(first.delivery).toBe(160); // 110 + 2 started kg over the first × 25
    expect(first.coupon).toMatchObject({ code: "GR10-OFF", pct: 10, amount: 210 }); // 10% of 2100
    expect(first.total).toBe(2050); // 2100 + 160 - 210
    expect(first.code).toMatch(/^GR[A-Z2-9]{6}$/);
  });

  it("takes the stock and the coupon with the order", async () => {
    expect((await product("p1")).stock).toBe(3);
    expect((await product("p2")).stock).toBeUndefined(); // not counted, left alone
    expect(await coupon()).toMatchObject({ usedOrderId: first.id, usedOrder: first.code });
    const [cust] = await sql()<{ n: number }[]>`select count(*)::int as n from gr_docs where kind = 'customer'`;
    expect(cust!.n).toBe(1); // the customer list got the buyer
  });

  it("refuses a coupon that is already used, a sold-out product and more than the stock", async () => {
    expect(await refusal(checkout({ coupon: "GR10-OFF" }))).toMatchObject({ status: 422, fields: { coupon: expect.stringMatching(/already been used/) } });
    expect(await refusal(checkout({ items: [{ id: "p3", qty: 1 }] }))).toMatchObject({ status: 409, error: "unavailable", ids: ["p3"] });
    expect(await refusal(checkout({ items: [{ id: "p1", qty: 9 }] }))).toMatchObject({ status: 409, message: expect.stringMatching(/only 3 left/) });
    expect(await refusal(checkout({ trxId: "" }))).toMatchObject({ status: 422, fields: { trxId: expect.any(String) } });
    expect((await product("p1")).stock).toBe(3); // nothing was taken by the refused orders
  });

  it("cancelling gives the stock and the coupon back; bringing the order back takes them again", async () => {
    await saveOrder(first, { ...first, status: "cancelled" });
    expect((await product("p1")).stock).toBe(5);
    const freed = await coupon();
    expect(freed.usedOn).toBe("");
    expect(freed.usedOrderId).toBeUndefined();

    await saveOrder({ ...first, status: "cancelled" }, { ...first, status: "placed" });
    expect((await product("p1")).stock).toBe(3);
    expect(await coupon()).toMatchObject({ usedOrderId: first.id });
  });

  it("deleting an order that never left gives its stock back", async () => {
    await saveOrder(first, null);
    expect((await product("p1")).stock).toBe(5);
  });

  it("waits while another order is buying the same product, then sees the stock it left", async () => {
    await setStock("p1", 1);
    // another customer's order, in the middle of buying the last one: it holds the product's row
    let gotRow!: () => void;
    let finish!: () => void;
    const holding = new Promise<void>((r) => (gotRow = r));
    const done = new Promise<void>((r) => (finish = r));
    const other = sql().begin(async (tx) => {
      await tx`select 1 from gr_docs where kind = 'product' and id = 'p1' for update`;
      gotRow();
      await done;
      await tx`update gr_docs set data = data || '{"stock": 0, "inStock": false}' where kind = 'product' and id = 'p1'`;
    });
    await holding;
    const mine = refusal(checkout({ items: [{ id: "p1", qty: 1 }] }));
    await new Promise((r) => setTimeout(r, 300)); // this order must be waiting now, not deciding on the old stock
    finish();
    await other;
    expect(await mine).toMatchObject({ status: 409, error: "unavailable", ids: ["p1"] });
    await setStock("p1", 5);
  });

  it("sells the last one only once when two customers order it at the same moment", async () => {
    await setStock("p1", 1);
    const results = await Promise.all([1, 2].map(() => refusal(checkout({ items: [{ id: "p1", qty: 1 }] }))));
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(results.find((r) => r !== null)).toMatchObject({ status: 409 });
    const p1 = await product("p1");
    expect(p1.stock).toBe(0);
    expect(p1.inStock).toBe(false); // sold out at 0
  });

  describe("products sold in variants", () => {
    const variant = async (pid: string, vid: string) => (await product(pid)).variants!.find((v) => v.id === vid)!;

    it("prices each variant from the database and takes that variant's stock", async () => {
      const o = await m.orders.placeOrder(checkout({ items: [{ id: "pv", variant: "pv", qty: 2 }, { id: "pv", variant: "old500", qty: 1, price: 1 }] }), null);
      expect(o.items.map((i) => [i.productId, i.variantId, i.name, i.price, i.qty])).toEqual([
        ["pv", "pv", "APT Zero - 200 ml", 1499, 2],
        ["pv", "old500", "APT Zero - 500 ml", 2699, 1],
      ]);
      expect(o.items[1]!.image).toBe("/api/img/zero500-t"); // the small copy of the variant's own photo
      expect(o.subtotal).toBe(5697); // 2 × 1499 + 2699
      expect(o.weight).toBe(1.2); // 2 × 0.3 + 0.6 kg
      expect((await variant("pv", "pv")).stock).toBe(1);
      expect((await variant("pv", "old500")).stock).toBeUndefined(); // not counted, left alone

      // cancelling puts the variant's stock back
      await saveOrder(o, { ...o, status: "cancelled" });
      expect((await variant("pv", "pv")).stock).toBe(3);
    });

    it("refuses a sold-out variant, one that doesn't exist, more than its stock, and a product without a pick", async () => {
      expect(await refusal(checkout({ items: [{ id: "pv", variant: "v300", qty: 1 }] }))).toMatchObject({ status: 409, error: "unavailable" });
      expect(await refusal(checkout({ items: [{ id: "pv", variant: "nope", qty: 1 }] }))).toMatchObject({ status: 409, error: "unavailable" });
      expect(await refusal(checkout({ items: [{ id: "pv", variant: "pv", qty: 9 }] }))).toMatchObject({ status: 409, message: expect.stringMatching(/APT Zero - 200 ml \(only 3 left\)/) });
      // "pw" has no variant that kept its own id, so a line without a pick can't be priced
      expect(await refusal(checkout({ items: [{ id: "pw", qty: 1 }] }))).toMatchObject({ status: 409, error: "unavailable" });
      expect((await variant("pv", "pv")).stock).toBe(3);
    });

    it("sells from a cart saved before the merge: the old product is now a variant", async () => {
      const o = await m.orders.placeOrder(checkout({ items: [{ id: "old500", qty: 1 }, { id: "pv", qty: 1 }] }), null);
      expect(o.items.map((i) => [i.productId, i.variantId, i.price])).toEqual([
        ["pv", "old500", 2699],
        ["pv", "pv", 1499],
      ]);
      await saveOrder(o, null);
      expect((await variant("pv", "pv")).stock).toBe(3);
    });

    it("sells a variant's last one once, and the product sells out with its last variant", async () => {
      const results = await Promise.all([1, 2].map(() => refusal(checkout({ items: [{ id: "pw", variant: "w1", qty: 1 }] }))));
      expect(results.filter((r) => r === null)).toHaveLength(1);
      expect(await variant("pw", "w1")).toMatchObject({ stock: 0, inStock: false });
      expect((await product("pw")).inStock).toBe(false);
    });

    it("orders a variant with a custom name", async () => {
      const o = await m.orders.placeOrder(checkout({ items: [{ id: "pc", variant: "c3", qty: 2 }] }), null);
      expect(o.items.map((i) => [i.name, i.price, i.qty])).toEqual([["Moss ball - Pack of 3", 400, 2]]);
      expect(await variant("pc", "c3")).toMatchObject({ stock: 0, inStock: false });
    });

    it("keeps a variant's newer stock when the admin panel saves an older copy", () => {
      const server = { id: "pv", name: "APT Zero", price: 1499, variants: [{ id: "pv", kind: "ml" as const, amount: 200, price: 1499, stock: 1, stockAt: 20 }] };
      const panel = { ...server, variants: [{ ...server.variants[0]!, price: 1399, stock: 3, stockAt: 10 }] };
      const saved = m.orders.mergeProduct(server, panel);
      expect(saved.variants![0]).toMatchObject({ price: 1399, stock: 1, stockAt: 20 });
      expect(saved.price).toBe(1399);
    });
  });
});
