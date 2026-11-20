import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadCatalog } from "@/lib/server/catalog";
import { storeLinks } from "@/lib/server/links";
import { type PublicProduct, avgRating, plainText, tk } from "@/lib/site";
import { absoluteUrl, cleanName, findProduct, productPath } from "@/lib/seo";
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

/** One line under the title in search results: name, price, then the start of the description. */
const summary = (p: PublicProduct) => {
  const lead = `${cleanName(p.name)} price in Bangladesh: ${tk(p.price)}${p.inStock === false ? " (out of stock)" : ""}.`;
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
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: shop.name, locale: "en_BD", url, title, description, images: product.images.slice(0, 1).map((i) => absoluteUrl(i)) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: PageProps<"/store/products/[id]">) {
  const { product, exact, products } = await find((await params).id);
  if (!product) notFound();
  const L = await storeLinks();
  // an old address (the full id, or the product's earlier name): send people and search engines to the current one
  if (!exact) permanentRedirect(L.store(productPath(product)));
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
      <ProductDetail p={product} rating={{ avg: avgRating(reviews), count: reviews.length }} />
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
