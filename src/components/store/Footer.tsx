import Link from "next/link";
import { Clock, Landmark, Mail, MapPin, Phone } from "lucide-react";
import { POLICIES } from "@/lib/policies";
import { prettyPhone, waLink, type Links, type PublicShop } from "@/lib/site";
import { Grass } from "./Art";
import { FacebookIcon, WhatsAppIcon } from "./Icons";

const linkCls = "transition hover:text-sea-teal";

function LinkList({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="store-eyebrow">{title}</h2>
      <ul className="mt-4 grid gap-2.5 text-[14.5px] font-semibold text-sea-body">
        {items.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={linkCls}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The store footer: the brand (with how to pay and where to follow us), two short link lists (Shop, Help), the contact
 * details, then one bottom line with the policies and the credit. Phones: brand, then Shop and Help side by side, then contact.
 */
export function Footer({ shop, links }: { shop: PublicShop; links: Links }) {
  const s = shop.site;
  const shopLinks = [
    { href: links.store(), label: "Home" },
    { href: links.store("/products"), label: "Shop" },
    { href: links.store("/wholesale"), label: "Wholesale" },
    { href: links.store("/reviews"), label: "Customer reviews" },
    { href: links.store("/about"), label: "About us" },
  ];
  const helpLinks = [
    { href: links.nav.find((l) => l.label === "Order status")?.href ?? links.verify(), label: "Order status" },
    { href: links.verify(), label: "Verify purchase or staff" },
    { href: links.store("/faq"), label: "FAQ" },
    { href: links.store("/contact"), label: "Contact us" },
  ];
  const round = "grid size-9 place-items-center rounded-full bg-white ring-1 ring-sea-line transition hover:-translate-y-0.5 hover:ring-sea-ink/30";

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-sea-line bg-sea-paper">
      <Grass blades={90} seed={21} height={110} still className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full opacity-40" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-[1.35fr_0.8fr_0.9fr_1.25fr] lg:gap-x-10">
        {/* brand */}
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            {shop.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- shop logo
              <img src={shop.logo} alt="" className="size-11 rounded-full object-contain" />
            )}
            <span className="font-serif text-[26px] font-semibold">{shop.name}</span>
          </div>
          <p className="mt-3 font-serif text-[19px] leading-snug">
            Witness the <em className="text-sea-teal">Underwater World</em> Through Us
          </p>
          <p className="mt-2 text-[13px] font-semibold text-sea-muted">Importer &amp; supplier of aquarium plants &amp; accessories</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] font-bold uppercase tracking-wider text-sea-muted">We accept</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-[12.5px] font-bold text-[#E2136E] ring-1 ring-sea-line">
              {/* the real bKash logo, as on checkout */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed logo */}
              <img src="/pay/bkash.webp" alt="" width={20} height={20} className="size-5 rounded-full" /> bKash
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-sea-ink ring-1 ring-sea-line">
              <Landmark className="size-3.5" /> Bank transfer
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={round}>
              <WhatsAppIcon className="size-[18px] text-wa" />
            </a>
            {s.facebook && (
              <a href={s.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={round}>
                <FacebookIcon className="size-[18px] text-[#1877F2]" />
              </a>
            )}
            {shop.email && (
              <a href={`mailto:${shop.email}`} aria-label="Email" className={round}>
                <Mail className="size-[18px] text-sea-ink" />
              </a>
            )}
          </div>
        </div>

        <LinkList title="Shop" items={shopLinks} />
        <LinkList title="Help" items={helpLinks} />

        {/* contact */}
        <div className="col-span-2 lg:col-span-1">
          <h2 className="store-eyebrow">Get in touch</h2>
          <ul className="mt-4 grid gap-3 text-[14.5px] font-semibold text-sea-body sm:grid-cols-2 lg:grid-cols-1">
            <li>
              <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 ${linkCls}`}>
                <WhatsAppIcon className="size-[18px] shrink-0 text-wa" /> {prettyPhone(s.whatsapp)}
              </a>
            </li>
            {shop.phone && shop.phone !== s.whatsapp && (
              <li>
                <a href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`} className={`flex items-center gap-2.5 ${linkCls}`}>
                  <Phone className="size-[18px] shrink-0" /> {shop.phone}
                </a>
              </li>
            )}
            {shop.email && (
              <li>
                <a href={`mailto:${shop.email}`} className={`flex items-center gap-2.5 break-all ${linkCls}`}>
                  <Mail className="size-[18px] shrink-0" /> {shop.email}
                </a>
              </li>
            )}
            {s.address.trim() && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-[18px] shrink-0" /> {s.address}
              </li>
            )}
            {s.openingHours.trim() && (
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-[18px] shrink-0" />
                <span className="whitespace-pre-line font-medium">{s.openingHours.trim()}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* bottom line: copyright and policies, then the credit */}
      <div className="relative border-t border-sea-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 pb-16 pt-5 text-center text-[12.5px] font-semibold text-sea-ink/80 sm:px-6 lg:flex-row lg:justify-between lg:text-left">
          <p className="rounded-full bg-sea-paper/90 px-2 py-0.5">
            © {new Date().getFullYear()} {shop.name}
            {POLICIES.map((p) => (
              <span key={p.slug}>
                {" · "}
                <Link href={links.store(`/${p.slug}`)} className="underline-offset-2 hover:text-sea-ink hover:underline">
                  {p.short}
                </Link>
              </span>
            ))}
          </p>
          <p className="rounded-full bg-sea-paper/90 px-2 py-0.5 font-medium text-sea-ink/70">
            Developed by{" "}
            <a href="https://ratulhasan.dev" target="_blank" rel="noopener" className="font-semibold underline-offset-2 hover:text-sea-ink hover:underline">
              Ratul Hasan
            </a>
            {" · "}Website issues?{" "}
            <a href="mailto:ratul@ratulhasan.dev" className="font-semibold underline-offset-2 hover:text-sea-ink hover:underline">
              ratul@ratulhasan.dev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
