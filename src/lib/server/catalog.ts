import { cache } from "react";
import { connection } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { DEFAULT_SHOP, SEED_PRODUCTS } from "@/lib/seed";
import { onSite, publicProduct, siteSettings, type PublicProduct, type PublicShop } from "@/lib/site";
import type { Product, Shop } from "@/lib/types";
import { db, dbEnabled, ensureSchema } from "./db";
import { logoSrc } from "./logo";

const withDefaults = (shop: Partial<Shop> | null | undefined): Shop => ({
  ...DEFAULT_SHOP,
  ...shop,
  email: shop?.email?.trim() || DEFAULT_SHOP.email, // shops saved without an email address use the default one
  rates: DEFAULT_SHOP.rates,
});

/** The saved shop settings (defaults when there is no database or nothing saved yet). */
export async function loadShop(): Promise<Shop> {
  if (!dbEnabled()) return DEFAULT_SHOP;
  await ensureSchema();
  const [row] = await db()<{ data: Shop }[]>`select data from gr_docs where kind = 'shop' and id = 'shop'`;
  return withDefaults(row?.data);
}

export const publicShop = (shop: Shop): PublicShop => ({
  name: shop.name,
  tagline: shop.tagline,
  address: shop.address,
  phone: shop.phone,
  email: shop.email,
  logo: shop.logo ? logoSrc(shop.logo) : "",
  site: siteSettings(shop),
});

/** Every product shown on the website, newest first. */
export async function loadProducts(): Promise<PublicProduct[]> {
  if (!dbEnabled()) return SEED_PRODUCTS.filter(onSite).map(publicProduct);
  await ensureSchema();
  const rows = await db()<{ data: Product }[]>`select data from gr_docs where kind = 'product' order by updated_at desc`;
  return rows.map((r) => r.data).filter(onSite).map(publicProduct);
}

/** Tag of the cached catalogue: refreshCatalog() expires it. */
export const CATALOG_TAG = "catalog";
// bump when the cached shape (PublicShop / PublicProduct) changes, so a new deployment doesn't read an old shape
const CATALOG_VERSION = "2";

/**
 * The website's catalogue (shop settings + products), kept in Next's data cache instead of read from the database
 * for every page view: reading it every time - for every visitor and every search-engine crawl - used up the
 * database's monthly network allowance on 2026-11-20. It is read again when the admin saves products or settings,
 * or an order moves stock (refreshCatalog), and every 10 minutes as a backstop.
 */
const cachedCatalog = unstable_cache(
  async () => {
    const [shop, products] = await Promise.all([loadShop(), loadProducts()]);
    return { shop: publicShop(shop), products };
  },
  ["store-catalog", CATALOG_VERSION],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

/** The products on the website, from the cache (the cart and checkout check prices and stock again on the server). */
export const cachedProducts = async () => (dbEnabled() ? (await cachedCatalog()).products : loadProducts());

/**
 * Something on the website's catalogue changed (admin saved products or settings, an order took or gave back stock):
 * the next page view reads the database again. Only in Route Handlers and Server Actions.
 */
export function refreshCatalog() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
}

/** Shop + products for one page render (shared by the layout and the page; the page itself is never prerendered). */
export const loadCatalog = cache(async () => {
  await connection();
  try {
    if (!dbEnabled()) return { shop: publicShop(DEFAULT_SHOP), products: await loadProducts(), online: false };
    const { shop, products } = await cachedCatalog();
    return { shop, products, online: true };
  } catch (e) {
    console.error("store catalog failed", e);
    return { shop: publicShop(DEFAULT_SHOP), products: [] as PublicProduct[], online: false };
  }
});
