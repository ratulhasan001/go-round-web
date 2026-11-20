"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BriefcaseBusiness, Check, Clock, Copy, ExternalLink, Handshake, HelpCircle, ImagePlus, Landmark, LayoutGrid, LayoutTemplate, Loader2, Megaphone, MessageCircle, Palette, Pencil, Plus, QrCode, Rows3, Settings2, SquarePen, Star, Store, Trash2, Truck, BookOpen, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEFAULT_ABOUT, DEFAULT_FAQ, DEFAULT_HOME, DEFAULT_HOURS, DEFAULT_ZONES, FEATURE_CATEGORY_IDEAS, HERO_KEYS, sameName, siteSettings, absolute, publicLinks } from "@/lib/site";
import { CATEGORY_ICONS, categoryIconId, iconKey } from "@/lib/categoryIcons";
import { forget, storePhoto } from "@/lib/photos";
import { uid } from "@/lib/calc";
import { DELIVERY_AREAS, type DeliveryZone, type HomeSettings, type Review, type SiteSettings } from "@/lib/types";
import { SectionIcon } from "@/components/nav";
import { BlocksEditor, HeadlinesEditor, LayoutEditor, LogoListEditor, PreviewPanel } from "@/components/website/HomeDesign";
import { Button, Card, Field, Input, SectionTitle, Select, Switch, Textarea, cx, useToast } from "@/components/ui";

export default function WebsitePage() {
  const { shop, setShop, products, mode, ready } = useStore();
  const toast = useToast();
  const s = siteSettings(shop);
  // always the newest settings: a slow upload finishing later must not undo edits made meanwhile
  const latest = useRef(shop);
  useEffect(() => void (latest.current = shop), [shop]);
  const set = (patch: Partial<SiteSettings>) => {
    const now = latest.current;
    const next = { ...now, site: { ...siteSettings(now), ...patch } };
    latest.current = next;
    setShop(next);
  };
  /** Home page changes always build on the newest settings (photo uploads finish late). */
  const setHome = (fn: (h: HomeSettings) => HomeSettings) => set({ home: fn(siteSettings(latest.current).home) });
  const [tab, setTab] = useState<"design" | "settings">("design");
  const cloud = mode === "cloud";
  const heroChanged = HERO_KEYS.some((k) => JSON.stringify(s.home[k]) !== JSON.stringify(DEFAULT_HOME[k]));

  // the store's full address, read after mount (it depends on where the app is opened from)
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);
  const storeLink = origin ? publicLinks(new URL(origin).host).store() : "/store";
  const storeUrl = origin ? absolute(storeLink, origin) : "";
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onSiteCount = products.filter((p) => p.onSite !== false && p.name.trim() && p.price > 0).length;
  const withPhoto = products.filter((p) => p.onSite !== false && p.images?.length).length;
  const bankEmpty = !s.bank.accountNumber.trim();

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <SectionIcon section="website" className="size-11 rounded-2xl bg-deep text-lime shadow-lg shadow-deep/20" />
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Website</h1>
          <p className="text-sm text-muted">Everything customers see on your online store. Changes save automatically.</p>
        </div>
      </div>

      <div className="mb-5 flex gap-1 rounded-2xl border border-line bg-white p-1 sm:inline-flex" role="tablist" aria-label="Website sections">
        {(
          [
            { id: "design", label: "Home page design", Icon: Palette },
            { id: "settings", label: "Store settings", Icon: Settings2 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx("flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-bold transition sm:flex-none", tab === t.id ? "bg-deep text-lime shadow" : "text-muted hover:bg-canvas hover:text-ink")}
          >
            <t.Icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "design" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="order-first xl:order-last">
            <Card className="p-4 sm:p-5 xl:sticky xl:top-[calc(var(--nav-h,0px)+1rem)]">
              <PreviewPanel site={s} />
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {/* hero */}
            <Card className="p-5 sm:p-6">
              <SectionTitle
                icon={<LayoutTemplate className="size-4" />}
                title="Top of the page"
                hint="The big title, the text under it, the search box and the Shop button block"
                action={
                  heroChanged ? (
                    <Button size="sm" variant="ghost" onClick={() => setHome((h) => ({ ...h, ...Object.fromEntries(HERO_KEYS.map((k) => [k, DEFAULT_HOME[k]])) }))}>
                      Reset
                    </Button>
                  ) : undefined
                }
              />
              <HomeEditor home={s.home} onChange={(p) => setHome((h) => ({ ...h, ...p }))} />
            </Card>

            {/* news ticker */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<Megaphone className="size-4" />} title="News headlines" hint="Scroll in red along the top of every store page, under a “News” label" />
              <HeadlinesEditor value={s.announcement} onChange={(announcement) => set({ announcement })} />
            </Card>

            {/* text boxes */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<SquarePen className="size-4" />} title="Notices, announcements & greetings" hint="Your own boxes of text on the home page - with an optional photo and button" />
              <BlocksEditor home={s.home} cloud={cloud} update={setHome} />
            </Card>

            {/* order */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<Rows3 className="size-4" />} title="Page layout" hint="Everything on the home page, top to bottom - move it or switch it off" />
              <LayoutEditor home={s.home} update={setHome} />
            </Card>

            {/* featured categories */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<LayoutGrid className="size-4" />} title="Featured categories" hint="Medium tiles on the store's home page - pick as many as you like" />
              <FeaturedEditor
                value={s.featuredCategories}
                icons={s.categoryIcons}
                categories={[...new Set(products.map((p) => p.category?.trim()).filter(Boolean) as string[])]}
                onChange={(featuredCategories, categoryIcons) => set(categoryIcons ? { featuredCategories, categoryIcons } : { featuredCategories })}
                onIcons={(categoryIcons) => set({ categoryIcons })}
              />
            </Card>

            {/* partners */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<Handshake className="size-4" />} title="Our partners" hint="Partner names with their logos" />
              <LogoListEditor kind="partners" title={s.home.partnersTitle} items={s.home.partners} cloud={cloud} onTitle={(partnersTitle) => setHome((h) => ({ ...h, partnersTitle }))} update={(fn) => setHome((h) => ({ ...h, partners: fn(h.partners) }))} />
            </Card>

            {/* work experience */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<BriefcaseBusiness className="size-4" />} title="Work experience" hint="Companies and projects you have worked with, with their logos" />
              <LogoListEditor kind="experience" title={s.home.experienceTitle} items={s.home.experience} cloud={cloud} onTitle={(experienceTitle) => setHome((h) => ({ ...h, experienceTitle }))} update={(fn) => setHome((h) => ({ ...h, experience: fn(h.experience) }))} />
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            {/* status */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<Store className="size-4" />} title="Store" hint={`${onSiteCount} products on the website · ${withPhoto} with photos`} />
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
                <span>
                  <span className="block text-[14.5px] font-bold">{s.open ? "Taking orders" : "Orders paused"}</span>
                  <span className="block text-[12.5px] text-muted">
                    {s.open ? "Customers can check out on the website." : "Customers can browse, but checkout asks them to message you on WhatsApp."}
                  </span>
                </span>
                <Switch checked={s.open} label="Taking orders" onChange={(v) => set({ open: v })} />
              </label>
              {ready && mode !== "cloud" && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                  This copy of the app saves on this device only. The website shows sample products and can&apos;t take orders until the cloud database is connected.
                </p>
              )}

              <div className="mt-4">
                <Field label="Store link">
                  <div className="flex gap-2">
                    <Input readOnly value={storeUrl} onFocus={(e) => e.target.select()} aria-label="Store link" />
                    <Button
                      aria-label="Copy store link"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(storeUrl);
                          setCopied(true);
                          clearTimeout(timer.current);
                          timer.current = setTimeout(() => setCopied(false), 1600);
                        } catch {
                          toast("Could not copy - your browser blocked the clipboard", "err");
                        }
                      }}
                    >
                      {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
                    </Button>
                    <a href={storeLink} target="_blank" rel="noopener" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-deep px-4 text-sm font-semibold text-white hover:bg-ink">
                      Open <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </Field>
              </div>

            </Card>

            {/* contact */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<MessageCircle className="size-4" />} title="Contact" hint="The WhatsApp button and Contact page use these" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="WhatsApp number">
                  <Input type="tel" inputMode="tel" value={s.whatsapp} placeholder="+880 1…" onChange={(e) => set({ whatsapp: e.target.value })} />
                </Field>
                <Field label="Facebook page link">
                  <Input type="url" value={s.facebook} placeholder="https://facebook.com/…" onChange={(e) => set({ facebook: e.target.value })} />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Address on the website">
                  <Input value={s.address} placeholder="e.g. Dhaka/Khulna, Bangladesh" onChange={(e) => set({ address: e.target.value })} />
                </Field>
                <Field label="Opening hours (one line per row)">
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-3 size-4 text-faint" />
                    <Textarea className="pl-9" rows={2} value={s.openingHours} placeholder={DEFAULT_HOURS} onChange={(e) => set({ openingHours: e.target.value })} />
                  </div>
                </Field>
              </div>
              <p className="mt-3 text-[12px] text-muted">Shop name, phone and email come from Settings. Receipts keep the address in Settings.</p>
            </Card>

            {/* payments */}
            <Card className="p-5 sm:p-6">
              <SectionTitle icon={<Landmark className="size-4" />} title="Payments" hint="Shown to customers at checkout and on the order tracking page" />
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-pink-700">bKash</p>
              <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
                <Field label="bKash number">
                  <Input type="tel" inputMode="tel" value={s.bkash.number} placeholder="01XXXXXXXXX" onChange={(e) => set({ bkash: { ...s.bkash, number: e.target.value } })} />
                </Field>
                <Field label="Account type">
                  <Select value={s.bkash.type} onChange={(e) => set({ bkash: { ...s.bkash, type: e.target.value as SiteSettings["bkash"]["type"] } })}>
                    <option value="Personal">Personal (Send Money)</option>
                    <option value="Merchant">Merchant (Payment)</option>
                    <option value="Agent">Agent (Cash In)</option>
                  </Select>
                </Field>
              </div>
              <BkashQr value={s.bkash.qr ?? ""} cloud={mode === "cloud"} onChange={(qr) => set({ bkash: { ...siteSettings(latest.current).bkash, qr: qr || undefined } })} />
              <p className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-aqua-deep">Bank transfer</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bank name">
                  <Input value={s.bank.bank} placeholder="e.g. Dutch-Bangla Bank" onChange={(e) => set({ bank: { ...s.bank, bank: e.target.value } })} />
                </Field>
                <Field label="Account name">
                  <Input value={s.bank.accountName} placeholder="e.g. Go Round" onChange={(e) => set({ bank: { ...s.bank, accountName: e.target.value } })} />
                </Field>
                <Field label="Account number">
                  <Input inputMode="numeric" value={s.bank.accountNumber} placeholder="Account number" onChange={(e) => set({ bank: { ...s.bank, accountNumber: e.target.value } })} />
                </Field>
                <Field label="Branch">
                  <Input value={s.bank.branch} placeholder="Optional" onChange={(e) => set({ bank: { ...s.bank, branch: e.target.value } })} />
                </Field>
                <Field label="Routing number">
                  <Input inputMode="numeric" value={s.bank.routing} placeholder="Optional" onChange={(e) => set({ bank: { ...s.bank, routing: e.target.value } })} />
                </Field>
              </div>
              {bankEmpty && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                  No account number yet: customers who choose bank transfer are asked to message you on WhatsApp for the bank details.
                </p>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            {/* delivery */}
            <Card className="p-5 sm:p-6">
              <SectionTitle
                icon={<Truck className="size-4" />}
                title="Delivery"
                hint="Customers pick inside or outside Dhaka, then a courier service; the charge is added to their order"
                action={
                  JSON.stringify(s.zones) !== JSON.stringify(DEFAULT_ZONES) ? (
                    <Button size="sm" variant="ghost" onClick={() => set({ zones: DEFAULT_ZONES })}>
                      Reset
                    </Button>
                  ) : undefined
                }
              />
              <ZoneEditor zones={s.zones} onChange={(zones) => set({ zones })} />
              <div className="mt-5">
                <Field label="Delivery note (product pages and Contact us)">
                  <Textarea rows={2} value={s.deliveryNote} onChange={(e) => set({ deliveryNote: e.target.value })} />
                </Field>
              </div>
              <div className="mt-5 max-w-xs">
                <Field label="Free delivery on orders from (৳)">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={s.freeDeliveryOver || ""}
                    placeholder="0 = never free"
                    onChange={(e) => set({ freeDeliveryOver: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
              </div>
            </Card>

            {/* reviews */}
            <Card className="p-5 sm:p-6">
              <ReviewsEditor auto={s.autoApproveReviews} onAuto={(autoApproveReviews) => set({ autoApproveReviews })} />
            </Card>

            {/* about */}
            <Card className="p-5 sm:p-6">
              <SectionTitle
                icon={<BookOpen className="size-4" />}
                title="About us page"
                hint="A blank line starts a new paragraph"
                action={
                  s.about !== DEFAULT_ABOUT ? (
                    <Button size="sm" variant="ghost" onClick={() => set({ about: DEFAULT_ABOUT })}>
                      Reset
                    </Button>
                  ) : undefined
                }
              />
              <Textarea rows={9} value={s.about} onChange={(e) => set({ about: e.target.value })} />
            </Card>

            {/* faq */}
            <Card className="p-5 sm:p-6">
              <SectionTitle
                icon={<HelpCircle className="size-4" />}
                title="FAQ page"
                hint={`${s.faq.length} question${s.faq.length === 1 ? "" : "s"}`}
                action={
                  JSON.stringify(s.faq) !== JSON.stringify(DEFAULT_FAQ) ? (
                    <Button size="sm" variant="ghost" onClick={() => set({ faq: DEFAULT_FAQ })}>
                      Reset
                    </Button>
                  ) : undefined
                }
              />
              <FaqEditor faq={s.faq} onChange={(faq) => set({ faq })} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqEditor({ faq, onChange }: { faq: SiteSettings["faq"]; onChange: (f: SiteSettings["faq"]) => void }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...faq];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  const iconBtn = "grid size-8 place-items-center rounded-lg text-faint transition hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="flex flex-col gap-3">
      {faq.map((f, i) => (
        <div key={i} className={cx("rounded-2xl border border-line p-3")}>
          <div className="flex items-center gap-1">
            <span className="mr-auto text-[12px] font-bold text-muted">Q{i + 1}</span>
            <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              <ArrowUp className="size-4" />
            </button>
            <button type="button" className={iconBtn} disabled={i === faq.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              <ArrowDown className="size-4" />
            </button>
            <button type="button" className={cx(iconBtn, "hover:bg-red-50 hover:text-red-600")} onClick={() => onChange(faq.filter((_, j) => j !== i))} aria-label="Remove question">
              <Trash2 className="size-4" />
            </button>
          </div>
          <Input className="mt-1 font-semibold" value={f.q} placeholder="Question" aria-label={`Question ${i + 1}`} onChange={(e) => onChange(faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
          <Textarea className="mt-2" rows={2} value={f.a} placeholder="Answer" aria-label={`Answer ${i + 1}`} onChange={(e) => onChange(faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
        </div>
      ))}
      <Button size="sm" className="self-start" onClick={() => onChange([...faq, { q: "", a: "" }])}>
        <Plus className="size-3.5" /> Add question
      </Button>
    </div>
  );
}

/** The courier services customers choose from, grouped by area. */
function ZoneEditor({ zones, onChange }: { zones: DeliveryZone[]; onChange: (z: DeliveryZone[]) => void }) {
  const patch = (id: string, p: Partial<DeliveryZone>) => onChange(zones.map((z) => (z.id === id ? { ...z, ...p } : z)));
  const money = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <div className="flex flex-col gap-5">
      {DELIVERY_AREAS.map((area) => {
        const list = zones.filter((z) => z.area === area.id);
        return (
          <div key={area.id}>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-aqua-deep">{area.label}</p>
            <ul className="flex flex-col gap-2">
              {list.map((z) => (
                <li key={z.id} className="rounded-2xl border border-line p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[110px_1fr_96px_84px_auto]">
                    <Input aria-label="Courier" value={z.courier ?? ""} placeholder="Courier" onChange={(e) => patch(z.id, { courier: e.target.value })} />
                    <Input aria-label="Service" value={z.name} placeholder="e.g. Express delivery" onChange={(e) => patch(z.id, { name: e.target.value })} />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-muted">৳</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        disabled={!!z.quote}
                        aria-label={`${z.courier ?? ""} ${z.name} charge`}
                        className="pl-7 text-right font-semibold"
                        value={z.quote ? "" : z.fee || ""}
                        placeholder={z.quote ? "by location" : "0"}
                        onChange={(e) => patch(z.id, { fee: money(e.target.value) })}
                      />
                    </div>
                    <div className="relative" title="Added for every kg over the first">
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">/kg</span>
                      <Input type="number" inputMode="decimal" min={0} aria-label="Charge per extra kg" className="pr-9 text-right" value={z.perKg || ""} placeholder="+0" onChange={(e) => patch(z.id, { perKg: money(e.target.value) })} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(zones.filter((x) => x.id !== z.id))}
                      disabled={zones.length === 1}
                      className="grid size-10 place-items-center rounded-xl text-faint transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      aria-label={`Remove ${z.courier ?? ""} ${z.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <Input aria-label="Delivery time" value={z.eta ?? ""} placeholder="Delivery time, e.g. Within 48 hours after dispatch" onChange={(e) => patch(z.id, { eta: e.target.value })} />
                    <Input aria-label="Note" value={z.note ?? ""} placeholder="Note (optional)" onChange={(e) => patch(z.id, { note: e.target.value })} />
                    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[12.5px] font-semibold text-body">
                      <input type="checkbox" checked={!!z.quote} onChange={(e) => patch(z.id, { quote: e.target.checked })} className="size-4 accent-brand" />
                      Charge by location
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <Button size="sm" className="mt-2" onClick={() => onChange([...zones, { id: uid(), area: area.id, courier: list[0]?.courier ?? "", name: "", fee: 0, perKg: 0, eta: "" }])}>
              <Plus className="size-3.5" /> Add service {area.label.toLowerCase()}
            </Button>
          </div>
        );
      })}
      <p className="text-[12px] text-muted">
        Charges are for parcels up to 1 kg; <b>/kg</b> is added for every kg over that, from the products&apos; weights. &ldquo;Charge by location&rdquo; services cost nothing at checkout - you tell the customer the charge after the order.
      </p>
    </div>
  );
}

/** Upload (or remove) the photo of the shop's bKash QR code. */
function BkashQr({ value, cloud, onChange }: { value: string; cloud: boolean; onChange: (url: string) => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl bg-pink-50/60 p-3 ring-1 ring-pink-100">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-pink-100">
        {busy ? (
          <Loader2 className="size-6 animate-spin text-pink-700" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded QR code
          <img src={value} alt="bKash QR code" className="size-full object-contain" />
        ) : (
          <QrCode className="size-8 text-pink-300" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-bold">bKash QR code</p>
        <p className="text-[12px] text-muted">Shown at checkout and on the order page, so customers can scan to pay.</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => ref.current?.click()} disabled={busy}>
            <ImagePlus className="size-3.5" /> {value ? "Change" : "Upload QR"}
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                forget(value);
                onChange("");
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const url = await storePhoto(f, cloud);
            if (value) forget(value);
            onChange(url);
            toast("QR code saved");
          } catch {
            toast("Couldn't upload the QR code", "err");
          }
          setBusy(false);
        }}
      />
    </div>
  );
}

/** The top of the home page: the big title, the text under it, the search box and the Shop button block. */
function HomeEditor({ home, onChange }: { home: HomeSettings; onChange: (p: Partial<HomeSettings>) => void }) {
  const set = onChange;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Small line above the title">
          <Input value={home.eyebrow} placeholder={DEFAULT_HOME.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
        </Field>
        <Field label="Title - first line">
          <Input value={home.title1} placeholder={DEFAULT_HOME.title1} onChange={(e) => set({ title1: e.target.value })} />
        </Field>
        <Field label="Title - teal italic line">
          <Input value={home.titleHighlight} placeholder={DEFAULT_HOME.titleHighlight} onChange={(e) => set({ titleHighlight: e.target.value })} />
        </Field>
        <Field label="Title - last line">
          <Input value={home.title2} placeholder={DEFAULT_HOME.title2} onChange={(e) => set({ title2: e.target.value })} />
        </Field>
      </div>
      <Field label="Text under the title">
        <Textarea rows={2} value={home.intro} placeholder={DEFAULT_HOME.intro} onChange={(e) => set({ intro: e.target.value })} />
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
        <span>
          <span className="block text-[14.5px] font-bold">Search box</span>
          <span className="block text-[12.5px] text-muted">A search bar with a Search button under the title.</span>
        </span>
        <Switch checked={home.search} label="Search box on the home page" onChange={(v) => set({ search: v })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shop button - heading">
          <Input value={home.shopTitle} placeholder={DEFAULT_HOME.shopTitle} onChange={(e) => set({ shopTitle: e.target.value })} />
        </Field>
        <Field label="Shop button - text">
          <Input value={home.shopText} placeholder={DEFAULT_HOME.shopText} onChange={(e) => set({ shopText: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

/** Pick the categories for the home page tiles (as many as you like), each with its icon. */
function FeaturedEditor({
  value,
  icons,
  categories,
  onChange,
  onIcons,
}: {
  value: string[];
  icons: Record<string, string>;
  categories: string[];
  onChange: (v: string[], icons?: Record<string, string>) => void; // both in one save, so neither overwrites the other
  onIcons: (v: Record<string, string>) => void;
}) {
  const [custom, setCustom] = useState("");
  const [edit, setEdit] = useState<{ i: number; draft: string } | null>(null);
  const on = (c: string) => value.some((v) => sameName(v, c));
  const options = [...FEATURE_CATEGORY_IDEAS, ...categories, ...value].filter((c, i, all) => all.findIndex((x) => sameName(x, c)) === i);
  // the name editor is tied to a position, so it closes whenever the list changes under it
  const toggle = (c: string) => {
    setEdit(null);
    onChange(on(c) ? value.filter((v) => !sameName(v, c)) : [...value, c]);
  };
  const move = (i: number, d: -1 | 1) => {
    setEdit(null);
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  const iconBtn = "grid size-8 place-items-center rounded-lg text-faint transition hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30";
  const toast = useToast();
  /** Renames a tile; its icon pick moves with it. */
  const rename = (i: number, draft: string) => {
    const name = draft.trim().replace(/\s+/g, " ");
    const old = value[i]!;
    if (!name) return toast("Type a name for the category", "err");
    if (value.some((v, j) => j !== i && sameName(v, name))) return toast(`"${name}" is already on the list`, "err");
    setEdit(null);
    if (name === old) return;
    const pick = icons[iconKey(old)];
    const next = { ...icons };
    delete next[iconKey(old)];
    onChange(value.map((v, j) => (j === i ? name : v)), pick ? { ...next, [iconKey(name)]: pick } : next);
  };
  const remove = (i: number) => {
    setEdit(null);
    onChange(value.filter((_, j) => j !== i));
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            aria-pressed={on(c)}
            className={cx("h-9 rounded-full px-3.5 text-[13px] font-bold transition", on(c) ? "bg-deep text-lime" : "border border-line bg-white text-body hover:border-ink/30")}
          >
            {on(c) && <Check className="mr-1 inline size-3.5" />}
            {c}
            {!categories.some((x) => sameName(x, c)) && <span className="ml-1 text-[11px] font-semibold opacity-60">(no products yet)</span>}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim() && !on(custom.trim())) toggle(custom.trim());
          setCustom("");
        }}
      >
        <Input value={custom} placeholder="Another category" onChange={(e) => setCustom(e.target.value)} />
        <Button size="sm" type="submit" disabled={!custom.trim()}>
          Add
        </Button>
      </form>

      {value.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {value.map((c, i) => {
            const id = categoryIconId(c, icons);
            const Icon = CATEGORY_ICONS[id]!.icon;
            const editing = edit?.i === i;
            return (
              <li key={`${i}-${c}`} className={cx("flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2", editing ? "border-aqua-deep/50 ring-2 ring-aqua-deep/15" : "border-line")}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-deep text-lime">
                  <Icon className="size-[18px]" />
                </span>
                {editing ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      rename(i, edit.draft);
                    }}
                  >
                    <Input autoFocus className="!h-9" value={edit.draft} aria-label={`New name for ${c}`} onChange={(e) => setEdit({ i, draft: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEdit(null)} />
                    <button type="submit" className={cx(iconBtn, "text-brand")} aria-label="Save name" title="Save">
                      <Check className="size-4" />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => setEdit(null)} aria-label="Cancel" title="Cancel">
                      <X className="size-4" />
                    </button>
                  </form>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{c}</span>
                )}
                {!editing && (
                  <>
                    <div className="order-last w-full sm:order-none sm:w-44 sm:shrink-0">
                      <Select className="!h-9 text-[13px]" value={id} aria-label={`Icon for ${c}`} onChange={(e) => onIcons({ ...icons, [iconKey(c)]: e.target.value })}>
                        {Object.entries(CATEGORY_ICONS).map(([k, x]) => (
                          <option key={k} value={k}>
                            {x.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <span className="flex shrink-0 items-center">
                      <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c} up`} title="Move up">
                        <ArrowUp className="size-4" />
                      </button>
                      <button type="button" className={iconBtn} disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c} down`} title="Move down">
                        <ArrowDown className="size-4" />
                      </button>
                      <button type="button" className={iconBtn} onClick={() => setEdit({ i, draft: c })} aria-label={`Rename ${c}`} title="Edit name">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" className={cx(iconBtn, "hover:bg-red-50 hover:text-red-600")} onClick={() => remove(i)} aria-label={`Remove ${c}`} title="Remove from the home page">
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-muted">
        {value.length} chosen. Tap a name above to add or remove it, or use the pencil to rename and the bin to remove. Each tile shows its icon and links to the shop filtered to that category - so name your products&apos; categories the same way. A combined
        name such as &ldquo;Filtration &amp; Filter&rdquo; shows products from both categories.
      </p>
    </div>
  );
}

/** Customer reviews: approve or hide them, and add reviews by hand (e.g. from WhatsApp or Facebook). */
function ReviewsEditor({ auto, onAuto }: { auto: boolean; onAuto: (v: boolean) => void }) {
  const { reviews, setReviews, products, mode } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState({ productId: "", name: "", rating: 5, text: "" });
  const sorted = [...reviews].sort((a, b) => Number(a.approved) - Number(b.approved) || b.createdAt - a.createdAt);
  const pending = reviews.filter((r) => !r.approved).length;
  const save = (id: string, p: Partial<Review>) => setReviews(reviews.map((r) => (r.id === id ? { ...r, ...p, updatedAt: Date.now() } : r)));
  const named = products.filter((p) => p.name.trim()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <SectionTitle icon={<Star className="size-4" />} title="Reviews" hint={`${reviews.length} review${reviews.length === 1 ? "" : "s"}${pending ? ` · ${pending} waiting for approval` : ""}`} />
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
        <span>
          <span className="block text-[14.5px] font-bold">{auto ? "Automatic: customer reviews go live at once" : "Manual: you approve each customer review"}</span>
          <span className="block text-[12.5px] text-muted">Customers write reviews on product pages. Reviews you add below are always shown.</span>
        </span>
        <Switch checked={auto} label="Publish customer reviews automatically" onChange={onAuto} />
      </label>
      {mode !== "cloud" && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">Reviews need the cloud database - on this device they are only a preview.</p>}

      <form
        className="mt-4 grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim() || !draft.text.trim()) return toast("Add the customer's name and what they said", "err");
          const p = products.find((x) => x.id === draft.productId);
          const now = Date.now();
          setReviews([{ id: uid(), productId: draft.productId, ...(p ? { productName: p.name.trim() } : {}), name: draft.name.trim(), rating: draft.rating, text: draft.text.trim(), approved: true, source: "shop", createdAt: now, updatedAt: now }, ...reviews]);
          setDraft({ productId: draft.productId, name: "", rating: 5, text: "" });
          toast("Review added");
        }}
      >
        <p className="text-[13px] font-bold sm:col-span-2">Add a review by hand</p>
        <Select value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value })} aria-label="Product">
          <option value="">The shop in general</option>
          {named.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input value={draft.name} placeholder="Customer name" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Textarea className="sm:col-span-2" rows={2} value={draft.text} placeholder="What they said" onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <span className="flex" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={draft.rating === i} aria-label={`${i} stars`} onClick={() => setDraft({ ...draft, rating: i })} className="grid size-9 place-items-center">
                <Star className={cx("size-5", i <= draft.rating ? "fill-amber-400 text-amber-400" : "text-faint")} />
              </button>
            ))}
          </span>
          <Button size="sm" variant="primary" type="submit">
            <Plus className="size-3.5" /> Add review
          </Button>
        </div>
      </form>

      {sorted.length > 0 && (
        <ul className="mt-4 flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {sorted.map((r) => (
            <li key={r.id} className={cx("rounded-2xl border p-3", r.approved ? "border-line" : "border-amber-200 bg-amber-50/50")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
                    <span className="text-amber-500">{"★".repeat(r.rating)}</span>
                    <b>{r.name}</b>
                    <span className="text-muted">
                      {r.productName || "Shop"} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {r.source === "shop" ? "added by you" : "from the website"}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13.5px] text-body">{r.text}</p>
                </div>
                <Switch checked={r.approved} label={r.approved ? "Shown on the website" : "Approve"} onChange={(v) => save(r.id, { approved: v })} />
                <button type="button" onClick={() => setReviews(reviews.filter((x) => x.id !== r.id))} className="grid size-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-red-50 hover:text-red-600" aria-label="Delete review">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {!r.approved && <p className="mt-1 text-[12px] font-semibold text-amber-700">Waiting for approval - switch on to show it.</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
