import type { Metadata } from "next";
import { PolicyView } from "@/components/store/PolicyView";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return <PolicyView slug="privacy-policy" />;
}
