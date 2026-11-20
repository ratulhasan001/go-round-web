import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/CheckoutView";
import { PageHead } from "@/components/store/ui";

// personal pages: never in search results
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: true } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <PageHead eyebrow="Checkout" title={<>Almost <em>there</em></>} />
      <CheckoutView />
    </div>
  );
}
