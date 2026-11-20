import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { loadCatalog } from "@/lib/server/catalog";
import { waLink } from "@/lib/site";
import { WhatsAppIcon } from "@/components/store/Icons";
import { Reveal } from "@/components/store/Reveal";
import { PageHead, btn } from "@/components/store/ui";
import { pageMetadata } from "@/lib/server/seo";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/faq", title: "FAQ", description: "Answers about ordering from Go Round: bKash and bank payments, delivery inside and outside Dhaka, order status and returns." });

export default async function FaqPage() {
  const { shop } = await loadCatalog();
  const faq = shop.site.faq.filter((f) => f.q.trim());
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <PageHead eyebrow="FAQ" title={<>Good <em>questions</em></>} intro="Everything about ordering, paying and delivery." />
      <div className="divide-y divide-sea-line border-y border-sea-line">
        {faq.map((f, i) => (
          <Reveal key={i} delay={Math.min(i, 6) * 50}>
            <details className="group py-1" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16.5px] font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus className="size-5 shrink-0 text-sea-teal transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <Answer text={f.a} />
            </details>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-12 rounded-[28px] bg-sea-paper p-6 text-center ring-1 ring-sea-line">
        <p className="font-serif text-[24px]">Still wondering?</p>
        <p className="mt-1 text-[14.5px] text-sea-body">Ask us anything - we usually reply within a few hours.</p>
        <a href={waLink(shop.site.whatsapp, `Hi ${shop.name}! I have a question: `)} target="_blank" rel="noopener noreferrer" className={btn("primary", "lg", "mt-5")}>
          <WhatsAppIcon className="size-5 text-wa" /> Ask on WhatsApp
        </a>
      </Reveal>
    </div>
  );
}

/**
 * An answer, with its own little headings: "[ STEADFAST INSIDE DHAKA ]", a line in capitals ("DELIVERY RATES") or a
 * question on its own line ("How can I pay?") is set in bold, and "Express delivery: 110 BDT" lines get a bold label.
 */
function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="grid gap-3 pb-5 pr-2 text-[15px] leading-relaxed text-sea-body sm:pr-8">
      {blocks.map((block, i) => (
        <p key={i}>
          {block.split("\n").map((line, j) => {
            const t = line.trim();
            const heading = /^\[.*\]/.test(t) || (/^[A-Z0-9 &]{6,}$/.test(t) && /[A-Z]/.test(t)) || (/\?$/.test(t) && t.length < 60);
            const m = !heading && /^([^:]{3,40}):\s(.+)$/.exec(t);
            return (
              <span key={j} className="block">
                {heading ? (
                  <b className={/^\[/.test(t) ? "text-[13px] font-extrabold tracking-[0.06em] text-sea-teal" : "font-extrabold text-sea-ink"}>{t}</b>
                ) : m ? (
                  <>
                    <b className="font-bold text-sea-ink">{m[1]}:</b> {m[2]}
                  </>
                ) : (
                  t
                )}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
