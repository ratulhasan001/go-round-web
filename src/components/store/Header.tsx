"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Megaphone, ShoppingBag, Store, UserRound, X } from "lucide-react";
import { waLink } from "@/lib/site";
import { useShop } from "./StoreContext";
import { FacebookIcon, WhatsAppIcon } from "./Icons";

const isOn = (path: string, href: string, home: string) => (href === home ? path === href : path === href.split("?")[0] || path.startsWith(href + "/"));

export function Header() {
  const { shop, count, ready, links } = useShop();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]); // eslint-disable-line react-hooks/set-state-in-effect -- close the menu after navigating
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => void (document.body.style.overflow = "");
  }, [open]);
  useEffect(() => {
    if (ready && count) setBump((b) => b + 1); // eslint-disable-line react-hooks/set-state-in-effect -- replay the badge pop when the count changes
  }, [count, ready]);

  return (
    <>
      <NewsTicker text={shop.site.announcement} />
      <header className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ${scrolled ? "border-sea-line bg-sea-cream/90 shadow-[0_6px_24px_-18px_rgba(17,58,45,0.5)] backdrop-blur-md" : "border-transparent bg-sea-cream"}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-[72px] sm:px-6">
          <Link href={links.store()} className="flex min-w-0 items-center gap-2.5" aria-label={`${shop.name} home`}>
            {shop.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- shop logo
              <img src={shop.logo} alt="" className="size-10 shrink-0 rounded-full object-contain sm:size-11" />
            )}
            <span className="truncate font-serif text-[22px] font-semibold leading-none sm:text-[25px]">{shop.name}</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.nav.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isOn(path, l.href, links.store()) ? "page" : undefined}
                className="group relative rounded-full px-3.5 py-2 text-[14px] font-semibold text-sea-body transition-colors hover:text-sea-ink aria-[current=page]:text-sea-ink"
              >
                {l.label}
                <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-sea-leaf transition-transform duration-300 group-hover:scale-x-100 group-aria-[current=page]:scale-x-100" />
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <Link
              href={links.store("/products")}
              className="mr-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-sea-ink px-4 text-[14px] font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(17,58,45,0.7)] transition hover:bg-sea-teal active:scale-95"
            >
              <Store className="size-[17px]" /> Shop
            </Link>
            <Link href={links.store("/account")} className="grid size-11 place-items-center rounded-full text-sea-ink transition hover:bg-sea-sand/70" aria-label="My account">
              <UserRound className="size-[21px]" />
            </Link>
            <Link href={links.store("/cart")} className="relative grid size-11 place-items-center rounded-full text-sea-ink transition hover:bg-sea-sand/70" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <ShoppingBag className="size-[21px]" />
              {ready && count > 0 && (
                <span key={bump} className="sea-pop absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-sea-teal px-1 text-[11px] font-extrabold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
            <button onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full text-sea-ink transition hover:bg-sea-sand/70 lg:hidden" aria-label="Open menu" aria-expanded={open}>
              <Menu className="size-[22px]" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-sea-ink/30 backdrop-blur-[2px]" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="sea-drawer-in absolute inset-y-0 right-0 flex w-[min(86vw,360px)] flex-col bg-sea-cream shadow-2xl">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="store-eyebrow">Menu</span>
              <button onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full hover:bg-sea-sand/70" aria-label="Close menu">
                <X className="size-[22px]" />
              </button>
            </div>
            <nav className="flex flex-col px-3" aria-label="Main">
              {links.nav.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isOn(path, l.href, links.store()) ? "page" : undefined}
                  className="sea-sheet-in flex items-center justify-between rounded-2xl px-3 py-3.5 text-[18px] font-bold text-sea-ink transition hover:bg-sea-sand/60 aria-[current=page]:bg-sea-paper aria-[current=page]:text-sea-teal"
                  style={{ animationDelay: `${60 + i * 35}ms` }}
                >
                  {l.label}
                </Link>
              ))}
              <Link href={links.store("/account")} className="sea-sheet-in mt-1 rounded-2xl px-3 py-3.5 text-[18px] font-bold text-sea-ink hover:bg-sea-sand/60" style={{ animationDelay: "290ms" }}>
                My account
              </Link>
            </nav>
            <div className="mt-auto flex gap-2 p-5">
              <a href={waLink(shop.site.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-sea-ink text-[14px] font-bold text-white">
                <WhatsAppIcon className="size-5 text-wa" /> WhatsApp
              </a>
              {shop.site.facebook && (
                <a href={shop.site.facebook} target="_blank" rel="noopener noreferrer" className="grid size-12 place-items-center rounded-full border border-sea-line text-sea-ink" aria-label="Facebook">
                  <FacebookIcon className="size-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The shop's notice: important updates scrolling along the top of every page, one headline per line. */
function NewsTicker({ text }: { text: string }) {
  const items = text
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!items.length) return null;
  const line = (hidden?: boolean) => (
    <span className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className="flex items-center whitespace-nowrap px-6">
          <span className="mr-6 size-1.5 rounded-full bg-sea-sprout" />
          {t}
        </span>
      ))}
    </span>
  );
  return (
    <div className="flex items-stretch bg-sea-ink text-[13px] font-semibold text-sea-cream" role="region" aria-label="News">
      <span className="relative z-10 flex shrink-0 items-center gap-1.5 bg-sea-teal px-3 py-2 text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-white">
        <Megaphone className="size-3.5" /> News
      </span>
      <div className="sea-ticker relative flex min-w-0 flex-1 overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)]">
        <div className="sea-ticker-track flex w-max" style={{ "--ticker": `${Math.max(18, items.join(" ").length * 0.28)}s` } as React.CSSProperties}>
          {line()}
          {line(true)}
        </div>
      </div>
    </div>
  );
}
