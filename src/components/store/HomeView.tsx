import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, BadgePercent, LayoutGrid, PackageCheck, Search, ShoppingBag, Sparkles, Store, Wallet, Zap } from "lucide-react";
import { avgRating, heroShowcase, inCategory, waLink, type Links, type PublicProduct, type PublicShop } from "@/lib/site";
import { categoryIcon } from "@/lib/categoryIcons";
import type { HomeSectionKey } from "@/lib/types";
import type { PublicReview } from "@/lib/server/reviews";
import { ReviewCard, Stars } from "./Reviews";
import { Bubbles, Fish, Grass, Rule } from "./Art";
import { ProductCard } from "./ProductCard";
import { ProductImage } from "./ProductImage";
import { Reveal } from "./Reveal";
import { LazyAquarium } from "../aquarium/LazyAquarium";
import { WhatsAppIcon } from "./Icons";
import { btn, cx } from "./ui";
import { HomeBlockView, LogoSection } from "./HomeBlocks";
import { productPath } from "@/lib/seo";

/**
 * The store's home page, drawn from the shop's Website settings. Shared by the live page (a server component) and the
 * admin panel's live preview (in the browser), so it holds no state of its own.
 */
export function HomeView({ shop, products, reviews, links: L }: { shop: PublicShop; products: PublicProduct[]; reviews: PublicReview[]; links: Links }) {
  const inStock = products.filter((p) => p.inStock);
  const featured = [...products.filter((p) => p.featured && p.inStock), ...inStock.filter((p) => !p.featured)].slice(0, 8);
  const home = shop.site.home;
  // the categories the shop features (Website settings), each with its icon
  const categories = shop.site.featuredCategories
    .filter((c) => c.trim())
    .map((name) => {
      const inCat = products.filter((p) => inCategory(p.category, name));
      const names = [...new Set(inCat.map((p) => p.category))];
      // one product category: link with its exact spelling; a combined tile ("Filtration & Filter") links with its own name
      // up to three of its photos (in-stock products first) for the tile
      const pics = [...inCat.filter((p) => p.inStock), ...inCat.filter((p) => !p.inStock)].filter((p) => p.images.length).slice(0, 3);
      return { name: name.trim(), link: names.length === 1 ? names[0]! : name.trim(), count: inCat.length, pics, Icon: categoryIcon(name, shop.site.categoryIcons) };
    })
    // categories with nothing in them yet go last, in the shop's own order
    .sort((a, b) => Number(!a.count) - Number(!b.count));
  const brands = [...new Map(products.filter((p) => p.brand).map((p) => [p.brand.toLowerCase(), p.brand])).values()].sort((a, b) => a.localeCompare(b));
  // the photos beside the big title: what the admin chose (featured, on sale, new arrivals or a category) and its title
  const showcase = heroShowcase(products, home.showcase);
  const heroPics = showcase.pics;
  const ShowcaseIcon = { featured: Sparkles, sale: BadgePercent, new: Zap, category: LayoutGrid }[showcase.kind];

  /** Space above a section; the first one after the hero tucks under the grass. */
  const top = (first: boolean, gap: string) => (first ? "mt-4" : gap);

  // the home page's parts, shown and ordered as the Website settings say
  const section = (id: HomeSectionKey, first: boolean) => {
    if (id.startsWith("block:")) {
      const b = home.blocks.find((x) => `block:${x.id}` === id);
      if (!b || (!b.title.trim() && !b.text.trim() && !b.image)) return null;
      return (
        // the first one after the hero tucks up into the grass, like the steps do
        <section className={`relative mx-auto max-w-6xl px-4 sm:px-6 ${first ? "-mt-20 sm:-mt-28" : "mt-14"}`}>
          <HomeBlockView b={b} links={L} />
        </section>
      );
    }
    switch (id) {
      case "partners":
        return <LogoSection kind="partners" title={home.partnersTitle} items={home.partners} className={top(first, "mt-20")} links={L} />;

      case "experience":
        return <LogoSection kind="experience" title={home.experienceTitle} items={home.experience} className={top(first, "mt-20")} links={L} />;

      case "steps":
        return (
          <section className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className={`grid gap-3 sm:grid-cols-3 ${first ? "-mt-20 sm:-mt-28" : "mt-20"}`}>
              {[
                { icon: ShoppingBag, t: "Pick your product", d: "Add what you need to the cart - no account needed." },
                { icon: Wallet, t: "Pay by bKash or bank", d: "Send the total and type in the transaction ID." },
                { icon: PackageCheck, t: "We pack & deliver", d: "Check Order status any time with your mobile number." },
              ].map((s, i) => (
                <Reveal key={s.t} delay={i * 90} className="relative rounded-[24px] border border-sea-line bg-sea-paper/95 p-5 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-sea-teal-soft text-sea-teal">
                      <s.icon className="size-5" />
                    </span>
                    <span className="font-serif text-[15px] italic text-sea-muted">Step {i + 1}</span>
                  </div>
                  <h2 className="mt-3 text-[16px] font-extrabold">{s.t}</h2>
                  <p className="mt-1 text-[14px] leading-relaxed text-sea-body">{s.d}</p>
                </Reveal>
              ))}
            </div>
          </section>
        );

      case "shop":
        // a medium, easy-to-spot way into the shop
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-14")}`}>
            <Reveal className="flex flex-col items-center justify-between gap-4 rounded-[24px] bg-sea-teal px-6 py-6 text-center text-white sm:flex-row sm:px-8 sm:text-left">
              <div>
                {home.shopTitle.trim() && <p className="font-serif text-[22px] leading-tight sm:text-[26px]">{home.shopTitle}</p>}
                {home.shopText.trim() && <p className="mt-1 text-[14px] text-white/85">{home.shopText}</p>}
              </div>
              <Link href={L.store("/products")} className={btn("light", "md", "shrink-0 !h-12 !px-7 !text-[15px] !font-extrabold")}>
                <Store className="size-5" /> Shop now <ArrowRight className="size-4" />
              </Link>
            </Reveal>
          </section>
        );

      case "categories":
        if (!categories.length) return null;
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-20")}`}>
            <Reveal>
              <p className="store-eyebrow">Featured categories</p>
              <h2 className="mt-3 font-serif text-[34px] leading-tight sm:text-[44px]">
                Shop by <em className="text-sea-teal">category</em>
              </h2>
            </Reveal>
            {/* compact photo tiles: a collage of the category's own products, its icon, and how many there are */}
            <div className="mt-8 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
              {categories.map((c, i) => (
                <Reveal key={c.name} delay={(i % 6) * 50}>
                  <Link
                    href={`${L.store("/products")}?category=${encodeURIComponent(c.link)}`}
                    className={cx(
                      "group block h-full overflow-hidden rounded-[20px] bg-white ring-1 ring-sea-line transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(17,58,45,0.55)] hover:ring-sea-ink/25",
                      !c.count && "opacity-70",
                    )}
                  >
                    <span className="relative block aspect-square overflow-hidden bg-gradient-to-br from-sea-teal-soft to-sea-paper">
                      {c.pics.length >= 3 ? (
                        <span className="grid size-full grid-cols-[2fr_1fr] grid-rows-2 gap-0.5">
                          <span className="row-span-2 overflow-hidden">
                            <ProductImage src={c.pics[0]!.images[0]} name={c.pics[0]!.name} className="transition-transform duration-500 group-hover:scale-105" />
                          </span>
                          <span className="overflow-hidden">
                            <ProductImage src={c.pics[1]!.images[0]} name={c.pics[1]!.name} />
                          </span>
                          <span className="overflow-hidden">
                            <ProductImage src={c.pics[2]!.images[0]} name={c.pics[2]!.name} />
                          </span>
                        </span>
                      ) : c.pics.length ? (
                        <ProductImage src={c.pics[0]!.images[0]} name={c.pics[0]!.name} className="transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <c.Icon className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-sea-teal/70 sm:size-12" strokeWidth={1.4} />
                      )}
                      {/* the category's icon */}
                      <span className="absolute bottom-1.5 left-1.5 grid size-8 place-items-center rounded-full bg-sea-ink text-white shadow-md ring-2 ring-white sm:bottom-2 sm:left-2 sm:size-9">
                        <c.Icon className="size-4" strokeWidth={1.8} />
                      </span>
                    </span>
                    <span className="block px-2.5 pb-3 pt-2.5 sm:px-3">
                      <span className="flex items-start justify-between gap-1">
                        <span className="line-clamp-2 text-[13px] font-extrabold leading-snug text-sea-ink sm:text-[14px]">{c.name}</span>
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-sea-teal opacity-0 transition group-hover:opacity-100 max-sm:hidden" />
                      </span>
                      <span className="mt-0.5 block text-[11.5px] font-semibold text-sea-muted sm:text-[12px]">{c.count ? `${c.count} product${c.count === 1 ? "" : "s"}` : "Coming soon"}</span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        );

      case "products":
        if (!featured.length) return null;
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-24")}`}>
            <Reveal className="mb-8">
              <p className="store-eyebrow">From the shop</p>
              <h2 className="mt-3 font-serif text-[34px] leading-tight sm:text-[44px]">
                Hand-picked for <em className="text-sea-teal">your tank</em>
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 70}>
                  <ProductCard p={p} />
                </Reveal>
              ))}
            </div>
          </section>
        );

      case "brands":
        if (!brands.length) return null;
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-20")}`}>
            <Reveal>
              <p className="store-eyebrow">Brands</p>
              <h2 className="mt-3 font-serif text-[30px] leading-tight sm:text-[38px]">
                Brands we <em className="text-sea-teal">carry</em>
              </h2>
            </Reveal>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {brands.map((b) => (
                <Link key={b} href={`${L.store("/products")}?brand=${encodeURIComponent(b)}`} className="rounded-full border border-sea-line bg-sea-paper px-5 py-2.5 text-[15px] font-extrabold text-sea-ink transition hover:-translate-y-0.5 hover:border-sea-ink/30">
                  {b}
                </Link>
              ))}
            </div>
          </section>
        );

      case "reviews":
        if (!reviews.length) return null;
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-20")}`}>
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="store-eyebrow">Customer reviews</p>
                <h2 className="mt-3 font-serif text-[34px] leading-tight sm:text-[44px]">
                  What hobbyists <em className="text-sea-teal">say</em>
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-[14px] font-bold text-sea-body">
                  <Stars value={avgRating(reviews)} /> {avgRating(reviews).toFixed(1)} / 5
                </p>
                <Link href={L.store("/reviews")} className={btn("outline", "sm")}>
                  All reviews <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r, i) => (
                <Reveal key={r.id} delay={(i % 3) * 70}>
                  <ReviewCard r={r} showProduct />
                </Reveal>
              ))}
            </div>
          </section>
        );

      case "aquarium":
        // the shop's aquarium in guest mode (just the fish - never any shop data), on a planted tank
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-24")}`}>
            <Reveal className="mb-8 max-w-2xl">
              <p className="store-eyebrow">Take a break</p>
              <h2 className="mt-3 font-serif text-[34px] leading-tight sm:text-[44px]">
                Our little <em className="text-sea-teal">aquarium</em>
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-sea-body">A planted tank with schools of neon tetras, rummy-nose tetras and harlequin rasboras. Feed them, play with them, or tap one to meet it.</p>
            </Reveal>
            <Reveal>
              <LazyAquarium guest />
            </Reveal>
          </section>
        );

      case "about":
        return (
          <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${top(first, "mt-24")}`}>
            <Reveal className="relative overflow-hidden rounded-[32px] bg-sea-ink px-6 py-12 text-sea-cream sm:px-12 sm:py-16">
              <Grass blades={70} seed={33} height={160} className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-50" />
              <div className="relative max-w-2xl">
                <p className="store-eyebrow !text-sea-cream/60">About {shop.name}</p>
                <p className="mt-4 font-serif text-[26px] leading-snug sm:text-[34px]">
                  Importer &amp; supplier of <em className="text-sea-sprout">aquarium plants</em> &amp; accessories - for hobbyists who care about their tanks.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={L.store("/about")} className={btn("light", "md")}>
                    Our story
                  </Link>
                  <a href={waLink(shop.site.whatsapp)} target="_blank" rel="noopener noreferrer" className={btn("ghost", "md", "!text-sea-cream hover:!bg-white/10")}>
                    <WhatsAppIcon className="size-[18px] text-wa" /> Message us
                  </a>
                </div>
              </div>
            </Reveal>
          </section>
        );
    }
  };
  const visible = home.sections.filter((x) => x.on).map((x) => x.id);

  return (
    <>
      {/* hero - the visiting card, opened up */}
      <section className="relative overflow-hidden">
        <Grass blades={110} seed={11} height={260} className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] w-full sm:h-[240px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-[90px] h-0 sm:bottom-[130px]">
          <div className="sea-fish absolute left-0" style={{ "--dur": "38s", "--reach": "70vw" } as React.CSSProperties}>
            <Fish className="w-14 sm:w-20" />
          </div>
          <div className="sea-fish absolute left-0 top-10" style={{ "--dur": "52s", "--delay": "-20s", "--reach": "86vw" } as React.CSSProperties}>
            <Fish className="w-9 sm:w-12" width={3.4} />
          </div>
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-48 pt-12 sm:px-6 sm:pb-64 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            {home.eyebrow.trim() && <p className="store-eyebrow animate-fade-up">{home.eyebrow}</p>}
            <h1 className="mt-5 font-serif text-[46px] leading-[1.02] sm:text-[72px]">
              {home.title1.trim() && <span className="block animate-fade-up [animation-delay:60ms]">{home.title1}</span>}
              {home.titleHighlight.trim() && <em className="block animate-fade-up text-sea-teal [animation-delay:140ms]">{home.titleHighlight}</em>}
              {home.title2.trim() && <span className="block animate-fade-up [animation-delay:220ms]">{home.title2}</span>}
            </h1>
            <Rule className="mt-7 animate-fade-up [animation-delay:300ms]" />
            {home.intro.trim() && <p className="mt-6 max-w-md animate-fade-up text-[16px] leading-relaxed text-sea-body [animation-delay:340ms]">{home.intro}</p>}
            {home.search && (
              // a plain GET form: the shop page reads ?q= and opens with the search filled in
              <form action={L.store("/products")} method="get" role="search" className="mt-7 flex max-w-md animate-fade-up items-center gap-2 rounded-full border border-sea-line bg-white p-1.5 pl-5 shadow-[0_14px_30px_-22px_rgba(17,58,45,0.6)] [animation-delay:370ms] focus-within:border-sea-teal focus-within:ring-4 focus-within:ring-sea-teal/12">
                <Search className="size-[18px] shrink-0 text-sea-muted" aria-hidden />
                <input name="q" type="search" required placeholder="Search plants, ferts, tools…" aria-label="Search products" className="h-10 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-sea-ink outline-none placeholder:font-normal placeholder:text-sea-muted/80" />
                <button type="submit" className={btn("teal", "sm", "h-10 shrink-0")}>
                  <Search className="size-4" /> Search
                </button>
              </form>
            )}
            <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:400ms]">
              <Link href={L.store("/products")} className={btn("primary", "lg")}>
                Shop now <ArrowRight className="size-4" />
              </Link>
              <a href={waLink(shop.site.whatsapp, `Hi ${shop.name}! I'd like to ask about `)} target="_blank" rel="noopener noreferrer" className={btn("outline", "lg")}>
                <WhatsAppIcon className="size-[18px] text-wa" /> Ask us
              </a>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <Bubbles className="sea-bob absolute -top-24 right-10 h-32 w-20" />
            {heroPics.length ? (
              <div className="relative h-[460px]">
                {/* the title above the photos */}
                <div className="absolute inset-x-[4%] -top-2 z-20 flex items-center justify-between gap-3">
                  {/* a band of colour that keeps flowing, with a blinking dot - it should catch the eye */}
                  <p className="hero-pill relative inline-flex max-w-[72%] items-center gap-2.5 overflow-hidden rounded-full py-1.5 pl-1.5 pr-4 text-white ring-2 ring-white">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/18 ring-1 ring-white/30">
                      <ShowcaseIcon className="size-4" />
                    </span>
                    <span className="truncate text-[13px] font-extrabold uppercase leading-none tracking-[0.14em]">{showcase.title}</span>
                    <span className="relative flex size-2.5 shrink-0" aria-hidden>
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-300 opacity-80" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-lime-300" />
                    </span>
                  </p>
                  <Link href={L.store(showcase.link)} className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold text-sea-teal transition hover:bg-sea-teal-soft">
                    See all <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                {heroPics.map((p, i) => (
                  <div
                    key={p.id}
                    className="sea-bob absolute hover:z-10"
                    style={{ width: ["62%", "46%", "40%"][i], left: ["4%", "52%", "36%"][i], top: ["14%", "9%", "56%"][i], animationDelay: `${-i * 1.6}s` }}
                  >
                    <Link
                      href={L.store(productPath(p))}
                      className={`relative block aspect-square overflow-hidden rounded-[28px] shadow-[0_30px_60px_-30px_rgba(17,58,45,0.6)] ring-1 ring-sea-line transition-[rotate,scale] duration-500 hover:rotate-0 hover:scale-[1.03] ${["-rotate-4", "rotate-5", "-rotate-2"][i]}`}
                    >
                      <ProductImage src={p.images[0]} name={p.name} eager />
                      {home.showcase.source === "sale" && p.regularPrice > p.price && (
                        <span className="absolute left-3 top-3 rounded-full bg-sea-teal px-2.5 py-1 text-[12px] font-extrabold text-white shadow">
                          {Math.round((1 - p.price / p.regularPrice) * 100)}% OFF
                        </span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative mx-auto aspect-[4/5] w-[78%] rotate-2 overflow-hidden rounded-[32px] bg-sea-paper p-8 shadow-[0_30px_60px_-30px_rgba(17,58,45,0.6)] ring-1 ring-sea-line">
                {shop.logo && (
                  // eslint-disable-next-line @next/next/no-img-element -- shop logo
                  <img src={shop.logo} alt="" className="size-16 rounded-full object-contain" />
                )}
                <p className="mt-6 font-serif text-[30px] leading-tight">
                  Aquarium <em className="text-sea-teal">plants</em>
                  <br />
                  &amp; accessories
                </p>
                <p className="store-eyebrow mt-4 !text-[9.5px]">Importer &amp; supplier</p>
                <Grass blades={40} seed={5} height={160} className="absolute inset-x-0 bottom-0 h-[45%] w-full" />
              </div>
            )}
          </div>
        </div>
      </section>

      {visible.map((id, i) => (
        <Fragment key={id}>{section(id, i === 0)}</Fragment>
      ))}
    </>
  );
}
