import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadCatalog } from "@/lib/server/catalog";
import { keywordsFor } from "@/lib/server/seo";
import { storeLinks } from "@/lib/server/links";
import { type PublicProduct, avgRating, plainText, tk } from "@/lib/site";
import { SITE_URL, absoluteUrl, cleanName, findProduct, productPath } from "@/lib/seo";
import type { PublicReview } from "@/lib/server/reviews";
import { JsonLd } from "@/components/store/JsonLd";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductDetail } from "@/components/store/ProductDetail";
import { ProductReviews } from "@/components/store/Reviews";
import { loadReviews } from "@/lib/server/reviews";
import { Reveal } from "@/components/store/Reveal";

// the address is /products/<name>-<short id> (see productPath); the original /products/<full id> still works
async function find(segment: string) {
  const { shop, products } = await loadCatalog();
  return { ...findProduct(products, segment), products, shop };
}

/** The price, or the range of a product's variant prices: "Tk 799 - Tk 5,699". */
const priceText = (p: PublicProduct) => (p.priceTo > p.price ? `${tk(p.price)} - ${tk(p.priceTo)}` : tk(p.price));

/** One line under the title in search results: name, price (and sizes), then the start of the description. */
const summary = (p: PublicProduct) => {
  const sizes = p.variants.length > 1 ? ` Available in ${p.variants.map((v) => v.label).join(", ")}.` : "";
  const lead = `${cleanName(p.name)} price in Bangladesh: ${priceText(p)}${p.inStock === false ? " (out of stock)" : ""}.${sizes}`;
  const text = plainText(p.description).replace(/\s+/g, " ").trim();
  const all = text ? `${lead} ${text}` : `${lead} Order online, pay with bKash or bank transfer.`;
  return all.length > 160 ? `${all.slice(0, 157).replace(/\s+\S*$/, "")}...` : all;
};

export async function generateMetadata({ params }: PageProps<"/store/products/[id]">): Promise<Metadata> {
  const { product, shop } = await find((await params).id);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const title = `${cleanName(product.name)} Price in Bangladesh`;
  const description = summary(product);
  const url = productPath(product);
  return {
    title,
    description,
    // the product, how people search for its price, and where it sits in the shop
    keywords: keywordsFor(shop, [
      cleanName(product.name),
      `${cleanName(product.name)} price in Bangladesh`,
      product.brand,
      product.brand && `${product.brand} Bangladesh`,
      product.category,
      product.subcategory,
      product.subsubcategory,
    ].filter((k): k is string => !!k?.trim())),
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: shop.name, locale: "en_BD", url, title, description, images: product.images.slice(0, 1).map((i) => absoluteUrl(i)) },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** What Google shows for a product: price and stock, rating stars, the shop it's from, where it sits in the shop. */
function productData(p: PublicProduct, url: string, shopName: string, reviews: PublicReview[]) {
  const rated = reviews.filter((r) => r.rating >= 1 && r.rating <= 5);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: cleanName(p.name),
        url,
        image: p.images.map(absoluteUrl),
        description: plainText(p.description).replace(/\s+/g, " ").trim().slice(0, 5000) || cleanName(p.name),
        ...(p.sku ? { sku: p.sku } : {}),
        ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
        ...(p.category ? { category: [p.category, p.subcategory, p.subsubcategory].filter(Boolean).join(" > ") } : {}),
        // one offer, or one for each variant (500 ml, Large…) with its own price and stock
        offers: p.variants.length
          ? {
              "@type": "AggregateOffer",
              url,
              lowPrice: Math.min(...p.variants.map((v) => v.price)),
              highPrice: p.priceTo,
              offerCount: p.variants.length,
              priceCurrency: "BDT",
              availability: p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
              offers: p.variants.map((v) => ({
                "@type": "Offer",
                name: `${cleanName(p.name)} - ${v.label}`,
                url: `${url}?v=${encodeURIComponent(v.id)}`,
                price: v.price,
                priceCurrency: "BDT",
                ...(v.sku ? { sku: v.sku } : {}),
                availability: v.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
                seller: { "@type": "Organization", name: shopName, url: SITE_URL },
              })),
            }
          : {
              "@type": "Offer",
              url,
              price: p.price,
              priceCurrency: "BDT",
              availability: p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
              itemCondition: "https://schema.org/NewCondition",
              seller: { "@type": "Organization", name: shopName, url: SITE_URL },
            },
        ...(rated.length
          ? {
              aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avgRating(rated).toFixed(1)), reviewCount: rated.length, bestRating: 5, worstRating: 1 },
              review: rated.slice(0, 5).map((r) => ({
                "@type": "Review",
                author: { "@type": "Person", name: r.name },
                reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
                ...(r.text ? { reviewBody: r.text } : {}),
                datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
              })),
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/products` },
          ...(p.category ? [{ "@type": "ListItem", position: 3, name: p.category, item: `${SITE_URL}/products?category=${encodeURIComponent(p.category)}` }] : []),
          { "@type": "ListItem", position: p.category ? 4 : 3, name: cleanName(p.name), item: url },
        ],
      },
    ],
  };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/store/products/[id]">) {
  const { product, exact, variant: mergedVariant, products, shop } = await find((await params).id);
  if (!product) notFound();
  const L = await storeLinks();
  const asked = (await searchParams).v;
  const wanted = mergedVariant ?? (typeof asked === "string" ? asked : undefined);
  // an old address (the full id, the product's earlier name, or a product since merged into this one as a variant):
  // send people and search engines to the current one, with that variant picked
  if (!exact) permanentRedirect(`${L.store(productPath(product))}${wanted ? `?v=${encodeURIComponent(wanted)}` : ""}`);
  const reviews = await loadReviews(product.id);
  const related = products
    .filter((p) => p.id !== product.id && p.inStock)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
      <Link href={L.store("/products")} className="mb-6 inline-flex items-center gap-1 text-[13.5px] font-bold text-sea-muted hover:text-sea-ink">
        <ChevronLeft className="size-4" /> Back to shop
      </Link>
      <JsonLd data={productData(product, `${SITE_URL}${productPath(product)}`, shop.name, reviews)} />
      <ProductDetail key={wanted ?? ""} p={product} variant={wanted} rating={{ avg: avgRating(reviews), count: reviews.length }} />
      <ProductReviews productId={product.id} initial={reviews} />
      {related.length > 0 && (
        <section className="mt-24">
          <Reveal>
            <h2 className="mb-8 font-serif text-[30px] sm:text-[38px]">
              You may also <em className="text-sea-teal">like</em>
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {related.map((p, i) => (
              <Reveal key={p.id} delay={i * 70}>
                <ProductCard p={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
