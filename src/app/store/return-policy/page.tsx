import type { Metadata } from "next";
import { PolicyView } from "@/components/store/PolicyView";

export const metadata: Metadata = { title: "Return and cancellation policy" };

export default function Page() {
  return <PolicyView slug="return-policy" />;
}
