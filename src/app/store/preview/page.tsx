import type { Metadata } from "next";
import { loadCatalog } from "@/lib/server/catalog";
import { loadReviews } from "@/lib/server/reviews";
import { HomePreview } from "@/components/store/HomePreview";

export const metadata: Metadata = { title: "Home page preview", robots: { index: false, follow: false } };

/** The home page as the admin panel's Website page is editing it (opened in a frame there). */
export default async function PreviewPage() {
  const [{ shop, products }, reviews] = await Promise.all([loadCatalog(), loadReviews(undefined, 6)]);
  return <HomePreview shop={shop} products={products} reviews={reviews} />;
}
