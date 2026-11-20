import type { Metadata } from "next";
import type { PublicShop } from "@/lib/site";
import { SITE_URL } from "@/lib/seo";
import { loadCatalog } from "./catalog";

/** The picture shown when a store page is shared (WhatsApp, Facebook…), public/og.png, 1200 x 630. */
export const SHARE_IMAGE = { url: "/og.png", width: 1200, height: 630 };

/** How the shop describes itself in search results when a page has nothing more specific to say. */
export const shopDescription = (shop: PublicShop) =>
  `${shop.tagline}. Importer and supplier of aquarium plants, fertilisers and accessories in Bangladesh - order online, pay with bKash or bank transfer.`;

/**
 * Search and sharing details of a store page: its title and description, its one true address (`path`, e.g. "/faq",
 * so the same page reached another way - with tracking codes, say - isn't counted twice), and the share picture.
 * `index: false` keeps a page out of search results (cart, checkout…).
 */
export async function pageMetadata(o: { path: string; title?: string; description?: string; index?: boolean }): Promise<Metadata> {
  const { shop } = await loadCatalog();
  const description = o.description ?? shopDescription(shop);
  const title = o.title ? `${o.title} · ${shop.name}` : `${shop.name} · Importer & Supplier of Aquarium Plants & Accessories`;
  return {
    ...(o.title ? { title: o.title } : {}),
    description,
    alternates: { canonical: o.path },
    ...(o.index === false ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", siteName: shop.name, locale: "en_BD", url: o.path, title, description, images: [{ ...SHARE_IMAGE, alt: `${shop.name} - ${shop.tagline}` }] },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
  };
}

/**
 * The shop itself for search engines (schema.org OnlineStore + WebSite): its name, logo, contact details and Facebook
 * page, which Google uses for the shop's knowledge panel and the site name shown above results.
 */
export function shopData(shop: PublicShop) {
  const facebook = shop.site.facebook?.trim();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": `${SITE_URL}/#shop`,
        name: shop.name,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/logo.png`,
        image: `${SITE_URL}${SHARE_IMAGE.url}`,
        description: shopDescription(shop),
        slogan: shop.tagline,
        ...(shop.email ? { email: shop.email } : {}),
        ...(shop.phone ? { telephone: shop.phone } : {}),
        address: { "@type": "PostalAddress", addressCountry: "BD", ...(shop.address ? { addressLocality: shop.address.replace(/,?\s*Bangladesh\s*$/i, "") } : {}) },
        areaServed: { "@type": "Country", name: "Bangladesh" },
        currenciesAccepted: "BDT",
        paymentAccepted: "bKash, Bank transfer",
        ...(facebook ? { sameAs: [facebook] } : {}),
      },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: shop.name, url: `${SITE_URL}/`, inLanguage: "en", publisher: { "@id": `${SITE_URL}/#shop` } },
    ],
  };
}
