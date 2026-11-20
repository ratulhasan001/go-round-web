import { Suspense } from "react";
import type { Metadata } from "next";
import { loadCatalog } from "@/lib/server/catalog";
import { ShopBrowser } from "@/components/store/ShopBrowser";
import { PageHead } from "@/components/store/ui";
import { pageMetadata } from "@/lib/server/seo";
import { type PublicProduct, sameName, tk } from "@/lib/site";

/**
 * The whole shop, or one category of it (?category=…&sub=…&type=…, as the shop's filters link it). A real category gets
 * its own title and address, so search engines list it as a page of its own; anything else on the address (a search,
 * the sort order) doesn't make a new page.
 */
type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** The category (or sub-category, or type) the address asks for, with its products - null for the whole shop. */
function categoryOf(products: PublicProduct[], q: Query) {
  const inCat = products.filter((p) => p.category && sameName(p.category, one(q.category)));
  if (!inCat.length) return null;
  const category = inCat[0]!.category;
  const sub = (one(q.sub) && inCat.find((p) => sameName(p.subcategory, one(q.sub)))?.subcategory) || "";
  const inSub = sub ? inCat.filter((p) => sameName(p.subcategory, sub)) : inCat;
  const type = (sub && one(q.type) && inSub.find((p) => sameName(p.subsubcategory, one(q.type)))?.subsubcategory) || "";
  const list = type ? inSub.filter((p) => sameName(p.subsubcategory, type)) : inSub;
  const path = `/products?category=${encodeURIComponent(category)}${sub ? `&sub=${encodeURIComponent(sub)}` : ""}${type ? `&type=${encodeURIComponent(type)}` : ""}`;
  const prices = list.map((p) => p.price).filter((n) => n > 0);
  const brands = [...new Map(list.filter((p) => p.brand.trim()).map((p) => [p.brand.trim().toLowerCase(), p.brand.trim()])).values()];
  return { name: type || sub || category, list, path, from: prices.length ? Math.min(...prices) : 0, brands };
}

export async function generateMetadata({ searchParams }: PageProps<"/store/products">): Promise<Metadata> {
  const q = await searchParams;
  const { products } = await loadCatalog();
  const cat = categoryOf(products, q);
  if (!cat)
    return pageMetadata({ path: "/products", title: "Shop aquarium plants, fertilisers & accessories", description: `Shop ${products.length} aquarium plants, fertilisers, filters, lights and accessories in Bangladesh. Order online, pay with bKash or bank transfer, delivered anywhere in Bangladesh.` });
  const { name, list, path, from } = cat;
  return pageMetadata({
    path,
    title: `${name} Price in Bangladesh`,
    description: `${name} price in Bangladesh: ${list.length} product${list.length === 1 ? "" : "s"}${from ? ` from ${tk(from)}` : ""} at Go Round. Order online, pay with bKash or bank transfer.`,
  });
}

export default async function ShopPage({ searchParams }: PageProps<"/store/products">) {
  const [{ products }, q] = await Promise.all([loadCatalog(), searchParams]);
  // a category's own page: its name and a short introduction, for customers and search engines alike
  const cat = categoryOf(products, q);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      {cat ? (
        <PageHead
          eyebrow="Category"
          title={<>{cat.name}</>}
          intro={`${cat.name} for your aquarium, delivered anywhere in Bangladesh: ${cat.list.length} product${cat.list.length === 1 ? "" : "s"}${
            cat.brands.length ? ` from ${cat.brands.slice(0, 4).join(", ")}${cat.brands.length > 4 ? " and more" : ""}` : ""
          }${cat.from ? `, priced from ${tk(cat.from)}` : ""}. Order online and pay by bKash or bank transfer.`}
        />
      ) : (
        <PageHead eyebrow="The shop" title={<>Everything for a <em>planted tank</em></>} />
      )}
      <Suspense>
        <ShopBrowser products={products} />
      </Suspense>
    </div>
  );
}
