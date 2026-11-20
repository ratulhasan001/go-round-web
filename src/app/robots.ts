import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { areaOf } from "@/lib/site";
import { SITE_URL } from "@/lib/seo";

/**
 * /robots.txt, on every address (src/proxy.ts lets it through). The store may be crawled - except personal pages and
 * the API, but including product photos (/api/img) - and points to the sitemap. The admin panel, the verify address
 * and any other address (previews, localhost) are closed to search engines.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  if (areaOf(h.get("x-forwarded-host") ?? h.get("host")) !== "store") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/img/", "/api/shop-logo"],
      disallow: ["/account", "/cart", "/checkout", "/order-status", "/preview", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
