import type { Metadata } from "next";
import { CartView } from "@/components/store/CartView";
import { PageHead } from "@/components/store/ui";

// personal pages: never in search results
export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: true } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <PageHead eyebrow="Cart" title={<>Your <em>cart</em></>} />
      <CartView />
    </div>
  );
}
