import type { MetadataRoute } from "next";
import { areaOf } from "@/lib/site";
import { requestHost } from "@/lib/server/links";

const icons: MetadataRoute.Manifest["icons"] = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** "Add to Home Screen": the store installs as Go Round, the admin panel as GR Admin. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const area = areaOf(await requestHost());
  if (area === "store" || area === "verify")
    return {
      name: "Go Round · Aquarium Plants & Accessories",
      short_name: "Go Round",
      description: "Importer & supplier of aquarium plants & accessories in Bangladesh.",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons,
    };
  return {
    name: "Go Round Admin",
    short_name: "GR Admin",
    description: "Go Round admin panel: website orders, receipts, products, customers and staff.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#f3efe6",
    icons,
  };
}
