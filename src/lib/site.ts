// Shared by the customer website, its API routes and the admin panel. Nothing here touches the browser or the server.
import { DELIVERY_AREAS, type DeliveryArea, type DeliveryZone, type Faq, type HomeSectionId, type HomeSettings, type Order, type OrderStatus, type Product, type Shop, type SiteSettings } from "./types";

// ---------- where everything lives ----------
//
// Production runs on three addresses served by this one app (see src/proxy.ts):
//   goroundbd.com         the customer store, at the root (/products, /order-status…)
//   admin.goroundbd.com   the admin panel, behind the shop password
//   verify.goroundbd.com  check a purchase / order by mobile number, and staff QR codes
// Anywhere else (localhost, the *.vercel.app address) everything stays on one address: the admin panel at the root,
// the store under /store and the verify page under /store/verify.

export const DOMAIN = "goroundbd.com";
export const HOSTS = { store: DOMAIN, admin: `admin.${DOMAIN}`, verify: `verify.${DOMAIN}` } as const;
export type Area = "store" | "admin" | "verify" | "dev";

/** Which part of the app an address (host, with or without port) serves. */
export function areaOf(host: string | null | undefined): Area {
  const h = (host ?? "").toLowerCase().split(":")[0]!.replace(/^www\./, "");
  return h === HOSTS.store ? "store" : h === HOSTS.admin ? "admin" : h === HOSTS.verify ? "verify" : "dev";
}

/** Under these paths, a dev address serves the store (and its verify page). */
export const STORE_BASE = "/store";
export const isStorePath = (path: string) => path === STORE_BASE || path.startsWith(STORE_BASE + "/");

export interface Links {
  area: Area;
  /** A store page, e.g. store("/products"); store() is the home page. */
  store: (path?: string) => string;
  /** The verify page (purchase / order status by mobile number); verify() is its start page. */
  verify: (path?: string) => string;
  /** An admin page. */
  admin: (path?: string) => string;
  /** The page a staff member's QR code opens. */
  staff: (code: string) => string;
  /** The store's Order status page, optionally for one order. */
  orderStatus: (code?: string) => string;
  nav: { href: string; label: string }[];
}

/** Links as seen from a page on `host`: same-address links stay relative, links to another address are absolute. */
export function linksFor(host: string | null | undefined): Links {
  const area = areaOf(host);
  const p = (path = "") => (path === "/" ? "" : path);
  let store: Links["store"], verify: Links["verify"], admin: Links["admin"];
  if (area === "dev") {
    store = (path) => STORE_BASE + p(path);
    verify = (path) => `${STORE_BASE}/verify${p(path)}`;
    admin = (path) => p(path) || "/";
  } else {
    const on = (target: Area, h: string) => (path?: string) => `${area === target ? "" : `https://${h}`}${p(path) || "/"}`;
    store = on("store", HOSTS.store);
    verify = on("verify", HOSTS.verify);
    admin = on("admin", HOSTS.admin);
  }
  const orderStatus = (code?: string) => store("/order-status") + (code ? `?code=${encodeURIComponent(code)}` : "");
  return {
    area,
    store,
    verify,
    admin,
    staff: (code) => verify(`/${encodeURIComponent(code)}`),
    orderStatus,
    nav: [
      { href: store(), label: "Home" },
      { href: store("/products"), label: "Shop" },
      { href: orderStatus(), label: "Order status" },
      { href: store("/about"), label: "About us" },
      { href: store("/contact"), label: "Contact us" },
      { href: store("/faq"), label: "FAQ" },
    ],
  };
}

/** Extra pages listed under "Explore" (footer and the phone menu): reviews and the shop's policies. */
export const exploreLinks = (links: Links) => [
  { href: links.store("/reviews"), label: "Customer reviews" },
  { href: links.store("/privacy-policy"), label: "Privacy policy" },
  { href: links.store("/terms-and-conditions"), label: "Terms and conditions" },
  { href: links.store("/return-policy"), label: "Return policy" },
];

const STAFF_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
/** A fresh staff verification code (12 characters, about 59 bits - not something anyone can guess). */
export const makeStaffCode = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => STAFF_CHARS[b % STAFF_CHARS.length]).join("");

/**
 * Links the admin panel hands out (QR codes, WhatsApp messages, Visit store). Opened from the old *.vercel.app
 * address they still point at the real domains; only a local dev server keeps local links.
 */
export const publicLinks = (host: string) => linksFor(host.split(":")[0]!.endsWith(".vercel.app") ? HOSTS.admin : host);

/** Turns a link into a full address (for QR codes and messages), resolving relative links against `origin`. */
export const absolute = (link: string, origin: string) => new URL(link, origin).href;

export const FACEBOOK_URL = "https://www.facebook.com/share/1TbWgz8rXB/?mibextid=wwXIfr";

export const DEFAULT_ABOUT = `Go Round is an importer and supplier of aquarium plants and accessories in Bangladesh, with a base in Dhaka and Khulna.

We started Go Round because we love planted tanks and wanted hobbyists here to get the same quality of plants, fertilisers and equipment that aquascapers use around the world, without the guesswork.

Every order is packed by hand and checked before it leaves us. If you are not sure what your tank needs, message us on WhatsApp and we will help you choose.`;

export const DELIVERY_TIMELINES = `DELIVERY TIMELINES
Logistics partners: Pathao & Steadfast Courier

[ STEADFAST INSIDE DHAKA ]
Express delivery: within 8 hours after dispatch
Standard delivery: within 48 hours after dispatch

[ STEADFAST OUTSIDE DHAKA ]
Standard delivery: within 72 hours after dispatch

[ PATHAO INSIDE DHAKA ]
Instant delivery: arrives in about 1 hour
Express delivery: within 4 to 8 hours after dispatch (on request)
Standard delivery: within 48 hours after dispatch

[ PATHAO OUTSIDE DHAKA ]
Standard delivery: within 72 hours after dispatch

Important note: hub delivery is available only with Steadfast Courier. Delivery times may occasionally vary due to severe weather, courier delays or national emergencies. We appreciate your patience and understanding!`;

export const DELIVERY_RATES = `DELIVERY RATES

[ STEADFAST INSIDE DHAKA ]
Express delivery: 110 BDT
Standard delivery: 75 BDT

[ STEADFAST OUTSIDE DHAKA ]
Standard delivery: 135 BDT

[ PATHAO INSIDE DHAKA ] (requires 100% product prepayment)
Instant delivery: depending on location
Express delivery: depending on location
Standard delivery: 100 BDT

[ PATHAO OUTSIDE DHAKA ]
Standard delivery: 135 BDT

Important notes:
Steadfast hub delivery: 60 BDT (inside Dhaka) & 120 BDT (outside Dhaka)
Steadfast items over 1 kg: +25 BDT per extra kg (inside & outside Dhaka)
Pathao items over 1 kg: +20 BDT per extra kg (inside Dhaka) & +40 BDT per extra kg (outside Dhaka)`;

const PAY_A = "We accept bKash and bank transfer. At checkout, send the total and type in the transaction ID. We check every payment by hand and approve your order as soon as it reaches us.";
const RECEIPT_A = "Once we approve your payment, open Order status and type the mobile number you ordered with (or go to My account). Tap Download receipt to save it as a PDF.";
const PAY_Q = "How can I pay & how do I get my receipt?";
const SHIP_Q = "When will my order be shipped & how much is delivery?";
const SHIP_A = `${DELIVERY_TIMELINES}\n\n${DELIVERY_RATES}`;

export const DEFAULT_FAQ: Faq[] = [
  { q: "How do I place an order?", a: "Add products to your cart, go to checkout and fill in your name, phone number and address. You can order as a guest or with an account." },
  { q: PAY_Q, a: `How can I pay?\n${PAY_A}\n\nHow do I get my receipt?\n${RECEIPT_A}` },
  { q: SHIP_Q, a: SHIP_A },
  { q: "Do I need an account?", a: "No. You can check out as a guest. An account just keeps your details and order history in one place." },
  { q: "Can I ask before buying?", a: "Of course. Message us on WhatsApp and we will reply as soon as we can." },
];

/** The website settings with defaults filled in from the shop profile. */
export const DEFAULT_ADDRESS = "Dhaka/Khulna, Bangladesh";
export const DEFAULT_DELIVERY_NOTE = "Nationwide delivery through Steadfast (Express, Standard, Hub) & Pathao (Instant, Express, Standard)";
const OLD_DELIVERY_NOTE = "Nationwide delivery through Steadfast (Regular, Same day) & Pathao (Instant, Express, Same day)";
export const DEFAULT_HOURS = "7:00 AM to 7:00 PM Daily\nClosed on government holidays";
const OLD_HOURS = ["24/7"];
export const FEATURE_CATEGORY_IDEAS = ["Soil & Additives", "Fertilizer", "Light", "CO2 Solutions", "Filtration & Filter", "Accessories", "Filtration", "Filter", "Plants"];
export const DEFAULT_FEATURED = ["Soil & Additives", "Fertilizer", "Light", "CO2 Solutions", "Filtration & Filter", "Accessories"];
const OLD_FEATURED = ["Soil & Additives", "Fertilizer", "Light", "CO2 Solutions"];

export const HOME_SECTIONS: { id: HomeSectionId; label: string; hint: string }[] = [
  { id: "steps", label: "How it works", hint: "Pick, pay, we deliver - the three steps under the big title" },
  { id: "shop", label: "Shop button", hint: "A noticeable button into the shop" },
  { id: "categories", label: "Featured categories", hint: "Category tiles with their icons" },
  { id: "products", label: "Hand-picked products", hint: "Featured and newest products" },
  { id: "brands", label: "Brands", hint: "The brands of your products" },
  { id: "reviews", label: "Customer reviews", hint: "The newest approved reviews" },
  { id: "aquarium", label: "Our little aquarium", hint: "The illustrated planted tank" },
  { id: "about", label: "About us teaser", hint: "Dark box linking to About us" },
];

export const DEFAULT_HOME: HomeSettings = {
  eyebrow: "Aquarium plants & accessories · Bangladesh",
  title1: "Witness the",
  titleHighlight: "Underwater World",
  title2: "Through Us",
  intro: "Plants, fertilisers and equipment for planted tanks - picked by hobbyists, packed by hand and delivered to your door.",
  search: true,
  shopTitle: "Everything for your planted tank",
  shopText: "Plants, soil, fertilizer, lights, CO2 and filtration - all in one shop.",
  sections: HOME_SECTIONS.map((x) => ({ id: x.id, on: true })),
};

/** Saved home settings with anything missing filled in; sections added later join the end of the list. */
function homeSettings(h?: Partial<HomeSettings>): HomeSettings {
  const known = new Set(HOME_SECTIONS.map((x) => x.id));
  const saved = (h?.sections ?? []).filter((x, i, all) => known.has(x.id) && all.findIndex((y) => y.id === x.id) === i);
  const missing = DEFAULT_HOME.sections.filter((x) => !saved.some((y) => y.id === x.id));
  return { ...DEFAULT_HOME, ...h, sections: [...saved, ...missing] };
}

/** Same names as a list, in any order and case. */
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.some((y) => sameName(x, y)));

const z = (id: string, area: DeliveryArea, courier: string, name: string, fee: number, perKg: number, eta: string, extra: Partial<DeliveryZone> = {}): DeliveryZone => ({ id, area, courier, name, fee, perKg, eta, ...extra });
/** The couriers and rates the shop uses (from the delivery rate sheet). */
export const DEFAULT_ZONES: DeliveryZone[] = [
  z("sf-in-express", "inside", "Steadfast", "Express delivery", 110, 25, "Within 8 hours after dispatch"),
  z("sf-in-standard", "inside", "Steadfast", "Standard delivery", 75, 25, "Within 48 hours after dispatch"),
  z("sf-in-hub", "inside", "Steadfast", "Hub delivery", 60, 25, "Collect from the Steadfast hub"),
  z("pa-in-instant", "inside", "Pathao", "Instant delivery", 0, 20, "Arrives in about 1 hour", { quote: true, note: "Requires 100% product prepayment" }),
  z("pa-in-express", "inside", "Pathao", "Express delivery", 0, 20, "Within 4 to 8 hours after dispatch (on request)", { quote: true, note: "Requires 100% product prepayment" }),
  z("pa-in-standard", "inside", "Pathao", "Standard delivery", 100, 20, "Within 48 hours after dispatch", { note: "Requires 100% product prepayment" }),
  z("sf-out-standard", "outside", "Steadfast", "Standard delivery", 135, 25, "Within 72 hours after dispatch"),
  z("sf-out-hub", "outside", "Steadfast", "Hub delivery", 120, 25, "Collect from the Steadfast hub"),
  z("pa-out-standard", "outside", "Pathao", "Standard delivery", 135, 40, "Within 72 hours after dispatch"),
];

/** FAQs saved before the delivery rate sheet: the pay & receipt questions share one box, and so do shipping & delivery. */
function migrateFaq(faq: Faq[]): Faq[] {
  const is = (f: Faq, q: string) => f.q.trim().toLowerCase() === q.toLowerCase();
  const pay = faq.find((f) => is(f, "How can I pay?"));
  const receipt = faq.find((f) => is(f, "How do I get my receipt?"));
  const ship = faq.find((f) => is(f, "When will my order be shipped?"));
  const cost = faq.find((f) => is(f, "How much is delivery?"));
  if (!pay && !receipt && !ship && !cost) return faq;
  const out: Faq[] = [];
  for (const f of faq) {
    if (f === pay || (f === receipt && !pay)) {
      const a = (x?: Faq) => (x ? RENAMED_ANSWERS[x.a] ?? x.a : "");
      out.push({ q: PAY_Q, a: [pay && `How can I pay?\n${a(pay)}`, receipt && `How do I get my receipt?\n${a(receipt)}`].filter(Boolean).join("\n\n") });
    } else if (f === ship || (f === cost && !ship)) out.push({ q: SHIP_Q, a: SHIP_A });
    else if (f !== receipt && f !== cost) out.push(f);
  }
  return out;
}

const areaLabel = (a?: DeliveryArea) => DELIVERY_AREAS.find((x) => x.id === a)?.label ?? "";
/** "Inside Dhaka · Steadfast Express delivery" */
export const zoneLabel = (zone: DeliveryZone) => [areaLabel(zone.area), [zone.courier, zone.name].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

// FAQ answers from earlier defaults that still say "transaction ID" (order status now goes by mobile number)
const RENAMED_ANSWERS: Record<string, string> = {
  "Once we approve your payment, open Order status and type your transaction ID (or go to My account). Tap Download receipt to save it as a PDF.": "Once we approve your payment, open Order status and type the mobile number you ordered with (or go to My account). Tap Download receipt to save it as a PDF.",
  "We ship within 1 to 2 working days after approving the payment. You can follow every step on the Order status page - just type your transaction ID.": "We ship within 1 to 2 working days after approving the payment. You can follow every step on the Order status page - just type your mobile number.",
};

export function siteSettings(shop: Shop): SiteSettings {
  const s = shop.site;
  return {
    open: s?.open ?? true,
    announcement: s?.announcement ?? "",
    openingHours: s?.openingHours === undefined || OLD_HOURS.includes(s.openingHours.trim()) ? DEFAULT_HOURS : s.openingHours,
    whatsapp: s?.whatsapp ?? shop.phone,
    facebook: s?.facebook ?? FACEBOOK_URL,
    bkash: { number: shop.phone, type: "Personal", ...s?.bkash },
    bank: { bank: "", accountName: "", accountNumber: "", branch: "", routing: "", ...s?.bank },
    // zones saved before couriers were listed give way to the courier rate sheet
    zones: s?.zones?.some((x) => x.area) ? s.zones : DEFAULT_ZONES,
    freeDeliveryOver: s?.freeDeliveryOver ?? 0,
    address: s?.address ?? DEFAULT_ADDRESS,
    deliveryNote: !s?.deliveryNote || s.deliveryNote === OLD_DELIVERY_NOTE ? DEFAULT_DELIVERY_NOTE : s.deliveryNote,
    about: s?.about ?? DEFAULT_ABOUT,
    faq: migrateFaq(s?.faq ?? DEFAULT_FAQ).map((f) => ({ ...f, a: RENAMED_ANSWERS[f.a] ?? f.a })),
    // the first four defaults give way to the six categories the shop asked for
    featuredCategories: !s?.featuredCategories || sameList(s.featuredCategories, OLD_FEATURED) ? DEFAULT_FEATURED : s.featuredCategories,
    categoryIcons: s?.categoryIcons ?? {},
    home: homeSettings(s?.home),
    autoApproveReviews: s?.autoApproveReviews ?? true,
  };
}

/** What the public website may know about the shop - never charge rates, receipt numbers or the raw logo. */
export interface PublicShop {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  logo: string; // address of the logo image ("" = none)
  site: SiteSettings;
}

export interface PublicProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  inStock: boolean;
  images: string[];
  description: string;
  category: string;
  subcategory: string; // "" = none
  subsubcategory: string; // "" = none
  brand: string;
  sku: string;
  specification: string;
  regularPrice: number; // 0 = no discount
  stock: number | null; // null = not counted
  weight: number; // kg, 0 = not set
  warranty: string; // "" = no warranty
  featured: boolean;
}

export const onSite = (p: Product) => p.onSite !== false && !!p.name.trim() && p.price > 0;

export const publicProduct = (p: Product): PublicProduct => ({
  id: p.id,
  name: p.name.trim(),
  price: p.price,
  unit: p.unit?.trim() ?? "",
  // counted stock at 0 sells the product out too
  inStock: p.inStock !== false && !(typeof p.stock === "number" && p.stock <= 0),
  images: p.images ?? [],
  description: p.description ?? "",
  category: p.category?.trim() ?? "",
  // a subcategory only means something inside a category
  subcategory: p.category?.trim() ? (p.subcategory?.trim() ?? "") : "",
  subsubcategory: p.category?.trim() && p.subcategory?.trim() ? (p.subsubcategory?.trim() ?? "") : "",
  brand: p.brand?.trim() ?? "",
  sku: p.sku?.trim() ?? "",
  specification: p.specification ?? "",
  regularPrice: (p.regularPrice ?? 0) > p.price ? p.regularPrice! : 0,
  stock: typeof p.stock === "number" ? Math.max(0, Math.floor(p.stock)) : null,
  weight: Math.max(0, Number(p.weight) || 0),
  warranty: p.warranty?.trim() ?? "",
  featured: !!p.featured,
});

/** Average star rating (0 when there are no reviews). */
export const avgRating = (list: { rating: number }[]) => (list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0);

/** Same words, any case / spacing: "CO2 solutions" matches "Co2 Solutions". */
export const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/** The names a combined category stands for: "Filtration & Filter" -> Filtration, Filter. */
const categoryParts = (name: string) => name.split(/\s*(?:&|,|\/|\+|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);

/**
 * A product's category belongs to a wanted one: the same name, or - for a combined name such as "Filtration & Filter" -
 * one of its parts. A product filed under the full combined name matches too.
 */
export const inCategory = (category: string, wanted: string) => {
  if (!category.trim()) return false;
  if (sameName(category, wanted)) return true;
  const parts = categoryParts(wanted);
  return parts.length > 1 && parts.some((w) => sameName(w, category));
};

// ---------- product descriptions ----------
// The admin writes descriptions in a small formatting editor (bold, lists, headings, emoji), so they are HTML;
// descriptions saved before that are plain text. Only these tags are ever shown, with every attribute dropped.
const RICH_TAGS: Record<string, string> = {
  b: "b", strong: "b", i: "i", em: "i", u: "u", s: "s", strike: "s", del: "s",
  p: "p", div: "div", br: "br", ul: "ul", ol: "ol", li: "li", blockquote: "blockquote",
  h1: "h3", h2: "h3", h3: "h3", h4: "h4", h5: "h4", h6: "h4",
};
const isRich = (s: string) => /<\/?(b|strong|i|em|u|s|strike|del|p|div|br|ul|ol|li|blockquote|h[1-6]|span|font)\b[^>]*>/i.test(s);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A product description as safe HTML: formatting kept, everything else (scripts, links, styles, images) removed. */
export function richHtml(desc: string): string {
  if (!desc.trim()) return "";
  if (!isRich(desc)) return escapeHtml(desc).replace(/\r?\n/g, "<br>");
  return desc
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (!part.startsWith("<") || !part.endsWith(">")) return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const m = /^<(\/?)([a-z][a-z0-9]*)\b[^>]*>$/i.exec(part);
      const tag = m && RICH_TAGS[m[2]!.toLowerCase()];
      if (!tag) return "";
      if (tag === "br") return m[1] ? "" : "<br>";
      return `<${m[1]}${tag}>`;
    })
    .join("");
}

/** A description as plain text, for search and link previews. */
export function plainText(desc: string): string {
  if (!isRich(desc)) return desc.trim();
  return desc
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/blockquote)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Smaller copy of an uploaded photo for grids and thumbnails (data URLs have only one size). */
export const thumb = (src: string) => (src.startsWith("/api/img/") && !src.endsWith("-t") ? `${src}-t` : src);

/** Extra kilograms charged for: every started kg over the first one. */
export const extraKg = (weight: number) => Math.max(0, Math.ceil(Math.round(weight * 1000) / 1000 - 1));

/**
 * The delivery charge for an order: the service's fee plus its charge per extra kg. Services whose charge depends on
 * the location ("quote") cost nothing up front - the shop tells the customer the charge after the order.
 */
export function deliveryFee(settings: SiteSettings, zoneId: string, subtotal: number, weight = 0) {
  const zone = settings.zones.find((z) => z.id === zoneId) ?? settings.zones[0];
  if (!zone) return { zone: "Delivery", fee: 0, quote: false, extra: 0, zoneId: "" };
  const free = settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver;
  const extra = extraKg(weight) * Math.max(0, zone.perKg ?? 0);
  const fee = free || zone.quote ? 0 : Math.max(0, zone.fee) + extra;
  return { zone: zoneLabel(zone), fee, quote: !free && !!zone.quote, extra: free || zone.quote ? 0 : extra, zoneId: zone.id };
}

// ---------- police station ----------
// Checkout asks for the police station on its own; orders and the customer list keep it at the end of the address.
const PS_RE = /,?\s*P\.?\s*S\.?\s*:\s*([^,\n]+)\s*$/i;
export const withPoliceStation = (address: string, ps: string) => {
  const a = address.trim().replace(PS_RE, "");
  return ps.trim() ? `${a}, P.S.: ${ps.trim()}` : a;
};
export const splitPoliceStation = (address: string) => {
  const m = PS_RE.exec(address.trim());
  return m ? { address: address.trim().slice(0, m.index).trim(), ps: m[1]!.trim() } : { address: address.trim(), ps: "" };
};

// ---------- orders ----------

export const ORDER_STEPS: OrderStatus[] = ["placed", "confirmed", "shipped", "delivered"];

export const ORDER_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  confirmed: "Approved",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_HINT: Record<OrderStatus, string> = {
  placed: "We have your order and are checking the payment.",
  confirmed: "Payment approved - your receipt is ready and your order is being packed.",
  shipped: "Your parcel is on its way.",
  delivered: "Delivered. Enjoy your tank!",
  cancelled: "This order was cancelled.",
};

/**
 * Payments are checked by hand: the customer sends the transaction ID ("submitted" = waiting for approval), and the
 * shop approves it ("verified") or says it couldn't find it ("rejected", until the customer sends it again).
 */
export type PayState = "awaiting" | "submitted" | "rejected" | "verified";
export const payState = (o: Pick<Order, "payment">): PayState => {
  const p = o.payment;
  if (p.verified) return "verified";
  if (!p.trxId) return "awaiting";
  return p.rejectedAt && p.rejectedAt >= (p.submittedAt ?? 0) ? "rejected" : "submitted";
};

export const PAY_LABEL: Record<PayState, string> = {
  awaiting: "Awaiting payment",
  submitted: "Waiting for approval",
  rejected: "Payment not found",
  verified: "Payment approved",
};

/** Bank transfer with no bank details on the website: the customer has to ask for them first, so pays after ordering. */
export const needsTrxAtCheckout = (s: SiteSettings, method: string) => method === "bKash" || !!s.bank.accountNumber.trim();

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

/** Order code customers track with, e.g. GR7K3F9Q. `rand` returns n random bytes. */
export function makeOrderCode(rand: (n: number) => Uint8Array) {
  return "GR" + [...rand(6)].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// ---------- formatting & links ----------

/** ৳1,250 - whole taka when there are no paisa. */
export const tk = (n: number) =>
  "৳" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** 01XXXXXXXXX / +880… → 8801XXXXXXXXX for wa.me links */
export function waDigits(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = "88" + d;
  else if (d.startsWith("1") && d.length === 10) d = "880" + d;
  return d;
}

export const waLink = (phone: string, text = "") => `https://wa.me/${waDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** "+880 1309-372143" style for showing a Bangladeshi mobile number. */
export function prettyPhone(p: string) {
  const d = waDigits(p);
  return /^8801\d{9}$/.test(d) ? `+880 ${d.slice(3, 7)}-${d.slice(7)}` : p;
}
