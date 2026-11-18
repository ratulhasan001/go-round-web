// Home page parts the shop writes itself: text boxes (notice, announcement, greeting, update) and logo walls
// (partners, work experience). No state, so the live page and the admin preview draw them the same way.
import Link from "next/link";
import { ArrowRight, BellRing, Megaphone, Sparkles, TriangleAlert } from "lucide-react";
import { safeLink, type Links } from "@/lib/site";
import type { HomeBlock, HomeBlockStyle, LogoItem } from "@/lib/types";
import { Grass } from "./Art";
import { Reveal } from "./Reveal";
import { btn, cx } from "./ui";

/** "Our trusted partners" → "Our trusted <em>partners</em>", the card's teal italic on the last word. */
export function accent(title: string) {
  const t = title.trim();
  const at = t.lastIndexOf(" ");
  if (at < 0) return <em className="text-sea-teal">{t}</em>;
  return (
    <>
      {t.slice(0, at)} <em className="text-sea-teal">{t.slice(at + 1)}</em>
    </>
  );
}

const LOOK: Record<HomeBlockStyle, { box: string; label?: string; Icon?: typeof Megaphone; iconBox?: string; labelCls?: string; text: string; button: string }> = {
  notice: {
    box: "border-2 border-red-300 bg-red-50 text-red-950",
    label: "Notice",
    Icon: TriangleAlert,
    iconBox: "bg-red-600 text-white",
    labelCls: "text-red-600",
    text: "text-red-900/85",
    button: "bg-red-600 text-white hover:bg-red-700",
  },
  announcement: {
    box: "bg-sea-teal text-white",
    label: "Announcement",
    Icon: Megaphone,
    iconBox: "bg-white/15 text-white",
    labelCls: "text-white/75",
    text: "text-white/90",
    button: "bg-white text-sea-ink hover:bg-sea-paper",
  },
  greeting: {
    box: "bg-sea-ink text-sea-cream",
    label: "Greetings",
    Icon: Sparkles,
    iconBox: "bg-white/10 text-sea-sprout",
    labelCls: "text-sea-sprout",
    text: "text-sea-cream/85",
    button: "bg-sea-sprout text-sea-ink hover:bg-white",
  },
  update: {
    box: "border border-sea-line bg-sea-paper text-sea-ink",
    label: "Update",
    Icon: BellRing,
    iconBox: "bg-sea-teal-soft text-sea-teal",
    labelCls: "text-sea-teal",
    text: "text-sea-body",
    button: "bg-sea-ink text-white hover:bg-sea-moss",
  },
  plain: { box: "border border-sea-line bg-white text-sea-ink", text: "text-sea-body", button: "bg-sea-ink text-white hover:bg-sea-moss" },
};

/** One of the shop's text boxes. */
export function HomeBlockView({ b, links }: { b: HomeBlock; links: Links }) {
  const look = LOOK[b.style] ?? LOOK.plain;
  const greeting = b.style === "greeting";
  const href = b.button?.trim() ? safeLink(b.link, links) : "";
  const inside = href && (b.link ?? "").trim().startsWith("/");
  const buttonCls = btn("primary", "md", cx("mt-5 !shadow-none", look.button));
  const button = href ? (
    inside ? (
      <Link href={href} className={buttonCls}>
        {b.button} <ArrowRight className="size-4" />
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonCls}>
        {b.button} <ArrowRight className="size-4" />
      </a>
    )
  ) : null;

  return (
    <Reveal className={cx("relative overflow-hidden rounded-[24px] px-5 py-6 sm:px-8 sm:py-8", look.box)}>
      {greeting && <Grass blades={60} seed={41} height={140} className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-40" />}
      <div className={cx("relative grid items-center gap-6", b.image && "md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]")}>
        <div className={cx("flex gap-4", greeting && !b.image && "flex-col items-center text-center")}>
          {look.Icon && !greeting && (
            <span className={cx("hidden size-12 shrink-0 place-items-center rounded-full sm:grid", look.iconBox)}>
              <look.Icon className="size-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {look.label && (
              <p className={cx("flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.16em]", greeting && !b.image && "justify-center", look.labelCls)}>
                {look.Icon && <look.Icon className={cx("size-4", !greeting && "sm:hidden")} />}
                {look.label}
              </p>
            )}
            {b.title.trim() && <h2 className={cx("mt-2 font-serif leading-tight", greeting ? "text-[30px] sm:text-[42px]" : "text-[24px] sm:text-[30px]")}>{b.title}</h2>}
            {b.text.trim() && <p className={cx("mt-2 whitespace-pre-line text-[15px] leading-relaxed", greeting && !b.image && "mx-auto max-w-2xl", look.text)}>{b.text}</p>}
            {button}
          </div>
        </div>
        {b.image && (
          // eslint-disable-next-line @next/next/no-img-element -- photo the shop uploaded
          <img src={b.image} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[18px] object-cover ring-1 ring-black/5" />
        )}
      </div>
    </Reveal>
  );
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Logo({ item, className }: { item: LogoItem; className: string }) {
  return item.logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- logo the shop uploaded
    <img src={item.logo} alt={item.name ? `${item.name} logo` : "Logo"} loading="lazy" className={cx("object-contain", className)} />
  ) : (
    <span className={cx("grid place-items-center rounded-full bg-sea-teal-soft font-serif text-[20px] text-sea-teal", className, "aspect-square !w-auto")} aria-hidden>
      {initials(item.name)}
    </span>
  );
}

/** Partner logos, or the places the shop has worked - each with its name, and a link when it has one. */
export function LogoSection({ kind, title, items, className, links }: { kind: "partners" | "experience"; title: string; items: LogoItem[]; className: string; links: Links }) {
  const list = items.filter((x) => x.name.trim() || x.logo);
  if (!list.length) return null;
  const wrap = (x: LogoItem, cls: string, body: React.ReactNode) => {
    const href = safeLink(x.link, links);
    return href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cx(cls, "transition hover:-translate-y-0.5 hover:border-sea-ink/30")}>
        {body}
      </a>
    ) : (
      <div className={cls}>{body}</div>
    );
  };
  return (
    <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>
      <Reveal>
        <p className="store-eyebrow">{kind === "partners" ? "Partners" : "Experience"}</p>
        <h2 className="mt-3 font-serif text-[30px] leading-tight sm:text-[38px]">{accent(title || (kind === "partners" ? "Our partners" : "Where we have worked"))}</h2>
      </Reveal>
      {kind === "partners" ? (
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {list.map((x, i) => (
            <Reveal key={x.id} delay={(i % 5) * 60} className="h-full">
              {wrap(
                x,
                "flex h-full flex-col items-center justify-center rounded-[20px] border border-sea-line bg-white px-4 py-5 text-center",
                <>
                  <Logo item={x} className="h-16 w-full max-w-[150px]" />
                  {x.name.trim() && <span className="mt-3 text-[13.5px] font-extrabold leading-snug text-sea-ink">{x.name}</span>}
                  {x.note?.trim() && <span className="mt-0.5 text-[12px] text-sea-muted">{x.note}</span>}
                </>,
              )}
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {list.map((x, i) => (
            <Reveal key={x.id} delay={(i % 3) * 70} className="h-full">
              {wrap(
                x,
                "flex h-full items-center gap-4 rounded-[20px] border border-sea-line bg-sea-paper p-4",
                <>
                  <span className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-sea-line">
                    <Logo item={x} className="size-full" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15.5px] font-extrabold leading-snug text-sea-ink">{x.name}</span>
                    {x.note?.trim() && <span className="mt-0.5 block text-[13px] leading-snug text-sea-body">{x.note}</span>}
                  </span>
                </>,
              )}
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
