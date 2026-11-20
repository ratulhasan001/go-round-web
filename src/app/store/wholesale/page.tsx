import type { Metadata } from "next";
import { ClipboardList, Mail, MessageCircleMore, Phone, Truck } from "lucide-react";
import { loadCatalog } from "@/lib/server/catalog";
import { prettyPhone, waLink } from "@/lib/site";
import { WhatsAppIcon } from "@/components/store/Icons";
import { Reveal } from "@/components/store/Reveal";
import { PageHead, btn } from "@/components/store/ui";
import { pageMetadata } from "@/lib/server/seo";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    path: "/wholesale",
    title: "Wholesale aquarium plants & accessories",
    description: "Wholesale prices on aquarium plants, fertilisers and equipment for fish shops, aquascapers and resellers in Bangladesh. Send your list on WhatsApp, call us or email us.",
    keywords: ["aquarium wholesale Bangladesh", "aquarium plants wholesale", "aquarium accessories wholesale", "aquarium supplier Bangladesh", "aquarium importer Bangladesh"],
  });

// what a wholesale buyer is asked to send, already typed into the WhatsApp message and the email
const MESSAGE = `Hi! I'd like wholesale prices.
Business / shop name:
Items and quantities:
Delivery area:`;

const STEPS = [
  { icon: ClipboardList, t: "Send your list", d: "The items you need and how many of each - plants, fertilisers, filters, lights, anything in the shop." },
  { icon: MessageCircleMore, t: "Get your prices", d: "We reply with wholesale prices for your quantities, and the delivery charge to your area." },
  { icon: Truck, t: "Pay and receive", d: "Pay by bKash or bank transfer, and we pack and send your order anywhere in Bangladesh." },
];

const CARD = "flex h-full gap-4 rounded-[24px] border border-sea-line bg-sea-paper p-5";
const ICON = "grid size-14 shrink-0 place-items-center rounded-full bg-white ring-1 ring-sea-line";

/** Wholesale: for shops, aquascapers and resellers - WhatsApp or a call on one number, or email (from the menu). */
export default async function WholesalePage() {
  const { shop } = await loadCatalog();
  const s = shop.site;
  const digits = (p: string) => p.replace(/[^\d]/g, "").slice(-10);
  const phone = shop.phone.trim() || s.whatsapp;
  const call = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  // one number for both, unless the shop's phone and WhatsApp numbers differ
  const sameNumber = !shop.phone.trim() || digits(shop.phone) === digits(s.whatsapp);
  const hours = s.openingHours.trim().split("\n")[0] ?? "";
  const email = shop.email.trim();
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent("Wholesale prices")}&body=${encodeURIComponent(MESSAGE)}` : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <PageHead
        eyebrow="Wholesale"
        title={
          <>
            Buying in <em>bulk?</em>
          </>
        }
        intro="Fish shops, aquascapers, resellers and anyone setting up several tanks get wholesale prices on plants, fertilisers and equipment. Tell us what you need and we'll send you a price list."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* WhatsApp and calls: the same number */}
        <Reveal>
          <div className={CARD}>
            <span className={ICON}>
              <WhatsAppIcon className="size-6 text-wa" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="store-eyebrow block">WhatsApp &amp; call</span>
              <span className="mt-1 block truncate text-[17px] font-extrabold">{prettyPhone(s.whatsapp)}</span>
              {!sameNumber && <span className="block truncate text-[13px] font-semibold text-sea-body">Calls: {prettyPhone(shop.phone)}</span>}
              <span className="block text-[13px] text-sea-muted">{hours || "Send your list - the fastest way to get prices"}</span>
              <span className="mt-3 flex flex-wrap gap-2">
                <a href={waLink(s.whatsapp, MESSAGE)} target="_blank" rel="noopener noreferrer" className={btn("primary", "sm")}>
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
                {call && (
                  <a href={call} className={btn("outline", "sm")}>
                    <Phone className="size-4" /> Call
                  </a>
                )}
              </span>
            </span>
          </div>
        </Reveal>
        {mail && (
          <Reveal delay={70}>
            <a href={mail} className={`group ${CARD} items-center transition hover:-translate-y-0.5 hover:border-sea-ink/30 hover:shadow-[0_18px_40px_-28px_rgba(17,58,45,0.6)]`}>
              <span className={ICON}>
                <Mail className="size-6 text-sea-teal" />
              </span>
              <span className="min-w-0">
                <span className="store-eyebrow block">Email</span>
                <span className="mt-1 block truncate text-[17px] font-extrabold group-hover:text-sea-teal">{email}</span>
                <span className="block text-[13px] text-sea-muted">Send your list and we&apos;ll email your price list back</span>
              </span>
            </a>
          </Reveal>
        )}
      </div>

      <section className="mt-14">
        <Reveal>
          <h2 className="font-serif text-[30px] sm:text-[38px]">
            How it <em className="text-sea-teal">works</em>
          </h2>
        </Reveal>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.t} delay={i * 70}>
              <li className="h-full rounded-[24px] border border-sea-line bg-white p-5">
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-sea-ink text-[15px] font-extrabold text-white">{i + 1}</span>
                  <step.icon className="size-5 text-sea-teal" />
                </span>
                <span className="mt-4 block text-[17px] font-extrabold">{step.t}</span>
                <span className="mt-1 block text-[14px] leading-relaxed text-sea-body">{step.d}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <Reveal className="mt-10 flex flex-col items-start gap-4 rounded-[28px] bg-sea-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <span>
          <span className="block font-serif text-[26px] leading-tight">Ready with your list?</span>
          <span className="mt-1 block text-[14px] text-white/75">Message us on WhatsApp - your list is already started for you.</span>
        </span>
        <a href={waLink(s.whatsapp, MESSAGE)} target="_blank" rel="noopener noreferrer" className={btn("teal", "lg")}>
          <WhatsAppIcon className="size-5" /> Ask for wholesale prices
        </a>
      </Reveal>
    </div>
  );
}
