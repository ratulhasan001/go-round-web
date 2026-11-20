import type { Metadata } from "next";
import { PolicyView } from "@/components/store/PolicyView";
import { pageMetadata } from "@/lib/server/seo";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/terms-and-conditions", title: "Terms and conditions", description: "The terms for ordering from Go Round: prices, payment, delivery and use of the website." });

export default function Page() {
  return <PolicyView slug="terms-and-conditions" />;
}
