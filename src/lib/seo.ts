import { HOSTS } from "./site";

/** The shop's public address. Canonical links, the sitemap and Google's product data always point here. */
export const SITE_URL = `https://${HOSTS.store}`;

/** "APT  Fix--500 ml" → "APT Fix - 500 ml": a product name as it should read in titles and search results. */
export const cleanName = (s: string) => s.replace(/\s*-{2,}\s*/g, " - ").replace(/\s+/g, " ").trim();

/** "Neo Helios xp-450" → "neo-helios-xp-450": plain letters and digits only, "" for a name with none (e.g. all Bangla). */
export function slugify(s: string) {
  const slug = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 60) return slug;
  const cut = slug.slice(0, 60);
  const word = cut.lastIndexOf("-");
  return (word > 30 ? cut.slice(0, word) : cut).replace(/-+$/, "");
}

/** The short id at the end of a product's address: the first 8 characters of a long id (a UUID), or the whole id. */
const productKey = (id: string) => (id.length > 12 ? id.slice(0, 8) : id).toLowerCase();

/**
 * A product's store page, e.g. "/products/neo-helios-xp-450-78f9ee7b": its name for people and search engines, then a
 * short id that finds it even after the name changes. Build the full link with links.store(productPath(p)).
 */
export function productPath(p: { id: string; name: string }) {
  const slug = slugify(p.name);
  const key = encodeURIComponent(productKey(p.id));
  return `/products/${slug ? `${slug}-${key}` : key}`;
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * The product a /products/<segment> address means - its current address, an older one (the product was renamed), or
 * the original address with the full id. `exact` is false when the page should redirect to productPath(product).
 * A product merged into another (it became one of its variants) is found too: `variant` then names that variant.
 */
export function findProduct<P extends { id: string; name: string; variants?: { id: string }[] }>(
  products: P[],
  segment: string,
): { product: P; exact: boolean; variant?: string } | null {
  const s = decode(segment);
  const byId = products.find((p) => p.id === s);
  if (byId) return { product: byId, exact: decode(productPath(byId)) === `/products/${s}` };
  const key = s.slice(s.lastIndexOf("-") + 1).toLowerCase();
  const hits = products.filter((p) => productKey(p.id) === key);
  if (hits.length === 1) return { product: hits[0]!, exact: decode(productPath(hits[0]!)) === `/products/${s}` };
  if (hits.length) return null;
  const merged = products.flatMap((p) => (p.variants ?? []).filter((v) => v.id !== p.id && (v.id === s || productKey(v.id) === key)).map((v) => ({ product: p, variant: v.id })));
  return merged.length === 1 ? { ...merged[0]!, exact: false } : null;
}

/** An absolute address on the shop ("/api/img/x" → "https://goroundbd.com/api/img/x"); web addresses stay as they are. */
export const absoluteUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
