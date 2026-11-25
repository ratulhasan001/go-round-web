import Link from "next/link";
import { loadCatalog } from "@/lib/server/catalog";
import { storeLinks } from "@/lib/server/links";
import { POLICIES, POLICY_EFFECTIVE, fillPolicy, policy, type Policy } from "@/lib/policies";
import { prettyPhone } from "@/lib/site";
import { PageHead } from "./ui";

/** One of the shop's policy pages, with links to the other two. */
export async function PolicyView({ slug }: { slug: Policy["slug"] }) {
  const [{ shop }, L] = await Promise.all([loadCatalog(), storeLinks()]);
  const p = policy(slug);
  const fill = (t: string) => fillPolicy(t, { name: shop.name, phone: prettyPhone(shop.site.whatsapp || shop.phone), email: shop.email });
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <PageHead eyebrow={p.short} title={<PolicyTitle text={fill(p.title)} />} intro={`Effective ${POLICY_EFFECTIVE}`} />
      <article className="grid gap-7 text-[15.5px] leading-relaxed text-sea-body">
        {p.intro.map((t, i) => (
          <p key={i}>{fill(t)}</p>
        ))}
        {p.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-serif text-[22px] text-sea-ink sm:text-[24px]">{s.h}</h2>
            {s.p.map((t, i) => (
              <p key={i} className="mt-2.5">
                {fill(t)}
              </p>
            ))}
          </section>
        ))}
      </article>
      <nav className="mt-12 flex flex-wrap gap-2 border-t border-sea-line pt-6" aria-label="Policies">
        {POLICIES.filter((x) => x.slug !== slug).map((x) => (
          <Link key={x.slug} href={L.store(`/${x.slug}`)} className="rounded-full border border-sea-line bg-sea-paper px-4 py-2 text-[13.5px] font-bold text-sea-ink hover:border-sea-ink/30">
            {x.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** "Return and Cancellation Policy for Go Round": the shop's name always starts its own line, "for" with it. */
function PolicyTitle({ text }: { text: string }) {
  const at = text.lastIndexOf(" for ");
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="block">{text.slice(at + 1)}</span>
    </>
  );
}
