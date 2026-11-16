import type { Metadata } from "next";
import { PolicyView } from "@/components/store/PolicyView";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function Page() {
  return <PolicyView slug="terms-and-conditions" />;
}
