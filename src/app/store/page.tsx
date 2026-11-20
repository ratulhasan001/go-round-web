import { loadCatalog } from "@/lib/server/catalog";
import { loadReviews } from "@/lib/server/reviews";
import { storeLinks } from "@/lib/server/links";
import { HomeView } from "@/components/store/HomeView";
import { JsonLd } from "@/components/store/JsonLd";
import { pageMetadata, shopData } from "@/lib/server/seo";

export const generateMetadata = () => pageMetadata({ path: "/" });

export default async function StoreHome() {
  const [{ shop, products }, reviews, links] = await Promise.all([loadCatalog(), loadReviews(undefined, 6), storeLinks()]);
  return (
    <>
      <JsonLd data={shopData(shop)} />
      <HomeView shop={shop} products={products} reviews={reviews} links={links} />
    </>
  );
}
