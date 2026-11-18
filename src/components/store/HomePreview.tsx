"use client";

import { useEffect, useState } from "react";
import { HOSTS, PREVIEW_READY, PREVIEW_SITE, type PublicProduct, type PublicShop } from "@/lib/site";
import type { SiteSettings } from "@/lib/types";
import type { PublicReview } from "@/lib/server/reviews";
import { HomeView } from "./HomeView";
import { useShop } from "./StoreContext";

/**
 * The home page with the settings the admin panel is editing, sent over by the page that frames it. Only the admin
 * panel's own address may send them, and nothing here is saved: it only changes what this frame shows. Links and
 * buttons don't work in the frame, so a stray tap never leaves the preview or fills a cart.
 */
export function HomePreview({ shop, products, reviews }: { shop: PublicShop; products: PublicProduct[]; reviews: PublicReview[] }) {
  const { links, setPreviewSite } = useShop();
  const [site, setSite] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (window.parent === window) return; // opened on its own: just the saved home page
    const allowed = new Set([window.location.origin, `https://${HOSTS.admin}`]);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || !allowed.has(e.origin)) return;
      const d = e.data as { type?: string; site?: SiteSettings } | null;
      if (d?.type !== PREVIEW_SITE || !d.site?.home) return;
      setSite(d.site);
      setPreviewSite(d.site);
    };
    const block = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest("a, button, form")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("message", onMessage);
    document.addEventListener("click", block, true);
    document.addEventListener("submit", block, true);
    window.parent.postMessage({ type: PREVIEW_READY }, "*"); // carries nothing; the admin panel answers with its settings
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", block, true);
      document.removeEventListener("submit", block, true);
      setPreviewSite(null);
    };
  }, [setPreviewSite]);

  return <HomeView shop={site ? { ...shop, site } : shop} products={products} reviews={reviews} links={links} />;
}
