"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { useShop } from "./StoreContext";
import { btn } from "./ui";

const KEY = "gr-cookie-consent";

export type CookieChoice = "accepted" | "declined";

/**
 * The visitor's answer to the cookie banner (null until they answer). The store only sets the cookies it needs to work
 * (the login) and keeps the cart in the browser; anything optional added later - analytics, ads - must ask this first
 * and stay off unless it says "accepted".
 */
export function cookieChoice(): CookieChoice | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { choice?: CookieChoice } | null;
    return v?.choice === "accepted" || v?.choice === "declined" ? v.choice : null;
  } catch {
    return null;
  }
}

/** The cookie banner on the customer website: shown until the visitor accepts or declines, then never again. */
export function CookieBanner() {
  const { links } = useShop();
  const path = usePathname();
  const [show, setShow] = useState(false);
  // the home page preview inside the admin panel never shows it
  const preview = path.endsWith("/preview");

  useEffect(() => {
    if (preview || cookieChoice()) return;
    const id = window.setTimeout(() => setShow(true), 900); // after the page has settled
    return () => clearTimeout(id);
  }, [preview]);

  const choose = (choice: CookieChoice) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ choice, at: Date.now() }));
    } catch {
      /* private mode: asked again next visit */
    }
    setShow(false);
  };

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="animate-fade-up fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-[22px] border border-sea-line bg-white p-4 shadow-[0_24px_60px_-20px_rgba(17,58,45,0.45)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-[420px] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sea-sand text-sea-ink">
          <Cookie className="size-5" />
        </span>
        <div className="min-w-0">
          <p id="cookie-title" className="text-[15px] font-extrabold text-sea-ink">
            We use cookies
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-sea-body">
            Only to keep you logged in and remember your cart - no advertising or tracking cookies. Declining keeps just the ones the shop needs to work.{" "}
            <Link href={links.store("/privacy-policy")} className="font-bold text-sea-teal underline-offset-2 hover:underline">
              Privacy policy
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => choose("declined")} className={btn("outline", "sm")}>
          Decline
        </button>
        <button type="button" onClick={() => choose("accepted")} className={btn("primary", "sm", "min-w-24")}>
          Accept
        </button>
      </div>
    </div>
  );
}
