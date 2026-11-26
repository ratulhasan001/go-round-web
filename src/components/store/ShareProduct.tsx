"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { FacebookIcon, WhatsAppIcon } from "./Icons";
import { cx } from "./ui";

const noop = () => () => {};
const round = "grid size-10 place-items-center rounded-full border border-sea-line bg-white text-sea-ink transition hover:border-sea-ink/40 hover:bg-sea-sand/60";

/** Share this product: the phone's own share sheet where there is one, WhatsApp, Facebook, or copy the link. */
export function ShareProduct({ name }: { name: string }) {
  // the address as it stands, so the picked variant (?v=) goes with it; read when clicked, as picking a variant changes it
  const here = () => window.location.href;
  // the share sheet exists on phones (and some desktops); false on the server so the first paint matches
  const native = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(here());
      setCopied(true);
    } catch {
      window.prompt("Copy this link", here());
    }
  };
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[13.5px] font-bold text-sea-muted">Share:</span>
      {native && (
        <button onClick={() => navigator.share({ title: name, url: here() }).catch(() => {})} className={round} aria-label="Share" title="Share">
          <Share2 className="size-[18px]" />
        </button>
      )}
      <button onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${name}\n${here()}`)}`)} className={round} aria-label="Share on WhatsApp" title="WhatsApp">
        <WhatsAppIcon className="size-[18px] text-wa" />
      </button>
      <button onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(here())}`)} className={round} aria-label="Share on Facebook" title="Facebook">
        <FacebookIcon className="size-[18px] text-[#1877F2]" />
      </button>
      <button onClick={copy} className={cx(round, copied && "border-sea-leaf text-sea-leaf")} aria-label={copied ? "Link copied" : "Copy link"} title="Copy link">
        {copied ? <Check className="size-[18px]" /> : <Link2 className="size-[18px]" />}
      </button>
      <span aria-live="polite" className="text-[13px] font-bold text-sea-leaf">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
