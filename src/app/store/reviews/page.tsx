import type { Metadata } from "next";
import { loadReviews } from "@/lib/server/reviews";
import { ProductReviews } from "@/components/store/Reviews";
import { pageMetadata } from "@/lib/server/seo";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/reviews", title: "Customer reviews", description: "What hobbyists say about our plants, products and service - and write your own review." });

/** Every approved review, newest first, and a form to review the shop. */
export default async function ReviewsPage() {
  const reviews = await loadReviews(undefined, 120);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <ProductReviews productId="" initial={reviews} page />
    </div>
  );
}
