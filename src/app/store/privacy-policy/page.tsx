import type { Metadata } from "next";
import { PolicyView } from "@/components/store/PolicyView";
import { pageMetadata } from "@/lib/server/seo";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/privacy-policy", title: "Privacy policy", description: "How Go Round collects, uses and protects your personal details when you shop with us." });

export default function Page() {
  return <PolicyView slug="privacy-policy" />;
}
