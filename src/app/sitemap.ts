import type { MetadataRoute } from "next";
import { loadCatalog } from "@/lib/server/catalog";
import { SITE_URL, absoluteUrl, productPath } from "@/lib/seo";

// built from the live catalogue on every request (a new product is listed at once), never at build time
export const dynamic = "force-dynamic";

/**
 * /sitemap.xml: every page of the store a search engine should know - the main pages, each category of the shop and
 * every product, with its photos for image search. Personal pages (cart, checkout, account…) are left out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await loadCatalog();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" | "yearly") => ({ url: `${SITE_URL}${path}`, priority, changeFrequency });
  const categories = [...new Set(products.map((p) => p.category.trim()).filter(Boolean))];
  return [
    page("/", 1, "daily"),
    page("/products", 0.9, "daily"),
    ...categories.map((c) => page(`/products?category=${encodeURIComponent(c)}`, 0.8, "weekly")),
    ...products.map((p) => ({ ...page(productPath(p), 0.7, "weekly"), images: p.images.map(absoluteUrl) })),
    page("/wholesale", 0.6, "monthly"),
    page("/reviews", 0.5, "weekly"),
    page("/about", 0.5, "monthly"),
    page("/contact", 0.5, "monthly"),
    page("/faq", 0.5, "monthly"),
    page("/return-policy", 0.3, "yearly"),
    page("/privacy-policy", 0.2, "yearly"),
    page("/terms-and-conditions", 0.2, "yearly"),
  ];
}
