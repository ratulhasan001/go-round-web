import type { Metadata } from "next";
import { PolicyView } from "@/components/store/PolicyView";
import { pageMetadata } from "@/lib/server/seo";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/return-policy", title: "Return and cancellation policy", description: "How returns, replacements, cancellations and refunds work for orders from Go Round." });

export default function Page() {
  return <PolicyView slug="return-policy" />;
}
