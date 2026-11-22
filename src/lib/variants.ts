import type { Product, ProductVariant, VariantKind, VariantSize } from "./types";

// Products sold in more than one size or amount ("variants"): one product with a list of variants, each with its own
// price, stock, weight and photo - instead of one product per size. Shared by the admin panel (which edits and merges
// them), the website (which shows them and lets the customer pick one) and the server (which prices orders).

export interface VariantKindInfo {
  kind: VariantKind;
  label: string; // in the admin panel
  unit: string; // after the amount, e.g. "500 ml"
  min?: number; // the range the admin panel offers (kinds with an amount)
  max?: number;
  whole?: boolean; // whole numbers only
}

/** The kinds of variant, in the order they are offered and listed. kg and litre also take fractions, e.g. 0.67 L. */
export const VARIANT_KINDS: VariantKindInfo[] = [
  { kind: "kg", label: "Kilogram (kg)", unit: "kg", min: 1, max: 20 },
  { kind: "ml", label: "Millilitre (ml)", unit: "ml", min: 1, max: 10000, whole: true },
  { kind: "gm", label: "Gram (gm)", unit: "gm", min: 1, max: 10000, whole: true },
  { kind: "l", label: "Litre (L)", unit: "L", min: 1, max: 100 },
  { kind: "piece", label: "Piece", unit: "piece", min: 1, max: 10, whole: true },
  { kind: "pot", label: "Pot", unit: "pot", min: 1, max: 10, whole: true },
  { kind: "size", label: "Size", unit: "" },
  { kind: "bag", label: "Full bag", unit: "" },
];
export const SIZES: VariantSize[] = ["small", "medium", "large"];
export const SIZE_LABEL: Record<VariantSize, string> = { small: "Small", medium: "Medium", large: "Large" };

export const kindInfo = (kind: VariantKind) => VARIANT_KINDS.find((k) => k.kind === kind) ?? VARIANT_KINDS[0]!;
/** Kinds sold by an amount (everything but size and full bag). */
export const hasAmount = (kind: VariantKind) => kind !== "size" && kind !== "bag";

/**
 * An amount the admin typed, kept inside the kind's range: whole numbers for ml, gm, pieces and pots; kg and litres
 * also take fractions below 1 (0.5 kg, a 0.67 L bag of soil). Undefined when there is no usable number.
 */
export function clampAmount(kind: VariantKind, v: number | undefined): number | undefined {
  const k = kindInfo(kind);
  if (!hasAmount(kind) || v === undefined || !Number.isFinite(v) || v <= 0) return undefined;
  const n = k.whole ? Math.round(v) : Math.round(v * 1000) / 1000;
  return Math.min(k.max ?? n, Math.max(k.whole ? (k.min ?? 1) : 0.001, n));
}

const fmtAmount = (n: number) => String(Math.round(n * 1000) / 1000);

/** What a variant is called on the website and on receipts: "500 ml", "0.67 L", "2 pieces", "Large", "Full bag". */
export function variantLabel(v: Pick<ProductVariant, "kind" | "amount" | "size">): string {
  if (v.kind === "size") return v.size ? SIZE_LABEL[v.size] : "Size";
  if (v.kind === "bag") return "Full bag";
  const n = v.amount;
  const unit = kindInfo(v.kind).unit;
  if (n === undefined) return unit;
  if (v.kind === "piece" || v.kind === "pot") return `${fmtAmount(n)} ${n === 1 ? unit : `${unit}s`}`;
  return `${fmtAmount(n)} ${unit}`;
}

/** A variant's full name, as it goes on an order or a receipt: "APT Zero - 500 ml". */
export const variantName = (productName: string, v: Pick<ProductVariant, "kind" | "amount" | "size">) => `${productName.trim()} - ${variantLabel(v)}`;

/** Whether a product is sold in variants. */
export const hasVariants = (p: Pick<Product, "variants">): p is { variants: ProductVariant[] } => (p.variants?.length ?? 0) > 0;

/** A variant customers can buy: it has a price and says what it is (an amount, or a size). */
export const sellable = (v: ProductVariant) => v.price > 0 && (hasAmount(v.kind) ? (v.amount ?? 0) > 0 : v.kind !== "size" || !!v.size);

/** In stock: not marked out of stock, and a counted stock above 0. */
export const variantInStock = (v: Pick<ProductVariant, "inStock" | "stock">) => v.inStock !== false && !(typeof v.stock === "number" && v.stock <= 0);

const kindOrder = (k: VariantKind) => VARIANT_KINDS.findIndex((x) => x.kind === k);
/** Variants in the order customers see them: by kind, then smallest first (Small, Medium, Large). */
export const sortVariants = <V extends Pick<ProductVariant, "kind" | "amount" | "size">>(list: V[]): V[] =>
  [...list].sort(
    (a, b) =>
      kindOrder(a.kind) - kindOrder(b.kind) ||
      (a.amount ?? 0) - (b.amount ?? 0) ||
      (a.size ? SIZES.indexOf(a.size) : 0) - (b.size ? SIZES.indexOf(b.size) : 0),
  );

/** The variant that stands for the product in lists: the cheapest one in stock (the cheapest of all when none is). */
export function leadVariant(list: ProductVariant[]): ProductVariant | undefined {
  const ok = list.filter(sellable);
  const pool = ok.some(variantInStock) ? ok.filter(variantInStock) : ok;
  return pool.reduce<ProductVariant | undefined>((best, v) => (!best || v.price < best.price ? v : best), undefined);
}

/**
 * A product's new variant list, with the product-level fields that follow it: the price and discount of the lead
 * variant (lists, sorting and the receipt picker read those) and "in stock" when any variant is. Stock counts, weight
 * and purchase prices live on the variants, so the product's own are cleared. With no variants left the product is
 * sold as one again, at the price it shows now.
 */
export function withVariants(p: Product, variants: ProductVariant[]): Partial<Product> {
  if (!variants.length) return { variants: undefined };
  const lead = leadVariant(variants);
  return {
    variants,
    price: lead?.price ?? 0,
    regularPrice: lead && (lead.regularPrice ?? 0) > lead.price ? lead.regularPrice : undefined,
    inStock: variants.some((v) => sellable(v) && variantInStock(v)),
    stock: undefined,
    stockAt: undefined,
    purchasePrice: undefined,
    purchasePriceMax: undefined,
    unit: undefined,
  };
}

/** The variant a cart line or an order item means: by its id, or - for a line saved before the product had variants - the variant that kept the product's own id. */
export function findVariant(p: Product | { id: string; variants?: ProductVariant[] }, variantId?: string): ProductVariant | undefined {
  const list = p.variants ?? [];
  return list.find((v) => v.id === (variantId || p.id));
}

/**
 * The price list as receipts and letters pick from it: each product, or - for a product sold in variants - each
 * variant as a line of its own ("APT Zero - 500 ml", its price, its stock). Ids are "<product>~<variant>".
 */
export const perVariant = (products: Product[]): Product[] =>
  products.flatMap((p) =>
    hasVariants(p)
      ? sortVariants(p.variants).map((v) => ({
          id: `${p.id}~${v.id}`,
          name: variantName(p.name, v),
          price: v.price,
          regularPrice: v.regularPrice,
          inStock: variantInStock(v),
          images: v.image ? [v.image] : p.images,
          updatedAt: p.updatedAt,
        }))
      : [p],
  );

/** Every name the product is sold under: its own, and each variant's ("APT Zero - 500 ml"). Receipts match these. */
export const saleNames = (p: Product) => [p.name, ...(p.variants ?? []).map((v) => variantName(p.name, v))];

// ---------------------------------------------------------------------------------------------------------------
// Merging products that were saved once per size ("APT Zero - 200 ml", "APT Zero - 500 ml") into one with variants.

/** A size or amount read from a product's name. */
export interface NameParts {
  base: string; // the name without it, e.g. "APT Zero"
  amount?: { kind: VariantKind; amount: number };
  size?: VariantSize;
}

const UNITS: [string, VariantKind][] = [
  ["kilograms|kilogram|kilos|kilo|kgs|kg", "kg"],
  ["millilitres|millilitre|milliliters|milliliter|mls|ml", "ml"],
  ["grams|gram|gms|gm|gr|g", "gm"],
  ["litres|litre|liters|liter|litters|litter|ltrs|ltr|lt|l", "l"],
  ["pieces|piece|pcs|pc", "piece"],
  ["pots|pot", "pot"],
];
const AMOUNT = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNITS.map((u) => u[0]).join("|")})(?![a-z0-9])`, "gi");
const SIZE_WORDS: [RegExp, VariantSize][] = [
  [/(?<![a-z0-9])(small|s\s*size|size\s*s)(?![a-z0-9])/i, "small"],
  [/(?<![a-z0-9])(medium|m\s*size|size\s*m)(?![a-z0-9])/i, "medium"],
  [/(?<![a-z0-9])(large|big|l\s*size|size\s*l)(?![a-z0-9])/i, "large"],
];
const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[\s\-–_,:/|(]+$/, "")
    .replace(/^[\s\-–_,:/|)]+/, "")
    .trim();

/** Splits "APT  Fix--500 ml" into "APT Fix" and 500 ml, "Magnetic glass cleaner L Size" into the base and Large. */
export function parseName(name: string): NameParts {
  let rest = name;
  let amount: NameParts["amount"];
  const hits = [...name.matchAll(AMOUNT)];
  const last = hits.at(-1);
  if (last) {
    const unit = last[2]!.toLowerCase();
    const kind = UNITS.find(([re]) => re.split("|").includes(unit))![1];
    const n = clampAmount(kind, Number(last[1]));
    // outside the kind's range (e.g. "15 piece pack") it isn't a variant of the product
    if (n !== undefined && n === Math.round(Number(last[1]) * 1000) / 1000) {
      amount = { kind, amount: n };
      rest = rest.slice(0, last.index) + " " + rest.slice(last.index! + last[0].length);
    }
  }
  let size: VariantSize | undefined;
  for (const [re, s] of SIZE_WORDS) {
    const m = re.exec(rest);
    if (m) {
      size = s;
      rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
      break;
    }
  }
  // a lone S / M / L at the very end: "Nano CO2 Diffuser M"
  if (!size) {
    const m = /\s([SML])\s*$/.exec(tidy(rest) + " ");
    if (m) {
      size = ({ S: "small", M: "medium", L: "large" } as const)[m[1] as "S" | "M" | "L"];
      rest = tidy(rest).slice(0, -1);
    }
  }
  return { base: tidy(rest), ...(amount ? { amount } : {}), ...(size ? { size } : {}) };
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Pick3 = Pick<ProductVariant, "kind" | "amount" | "size">;

/** How each product of a group becomes a variant, and the merged product's name. Null when they can't be told apart. */
export function planMerge(products: Product[]): { name: string; variants: Map<string, Pick3> } | null {
  if (products.length < 2) return null;
  const parts = products.map((p) => ({ p, n: parseName(p.name) }));
  const all = <T,>(f: (x: (typeof parts)[number]) => T) => parts.map(f);
  const label = (a?: NameParts["amount"]) => (a ? variantLabel({ kind: a.kind, amount: a.amount }) : "");
  const distinct = (xs: string[]) => xs.every((x) => !!x) && new Set(xs).size === xs.length;
  const sameAll = (xs: string[]) => new Set(xs).size === 1;
  const keep = pickKeeper(products);
  const base = parts.find((x) => x.p.id === keep.id)!.n.base;
  const amounts = all((x) => label(x.n.amount));
  const sizes = all((x) => x.n.size ?? "");
  // different sizes of the same amount (Small / Medium, 70 gm each): the size is the variant, the amount stays in the name
  if (distinct(sizes) && sameAll(amounts)) {
    const common = amounts[0] ? ` - ${amounts[0]}` : "";
    return { name: `${base}${common}`, variants: new Map(parts.map((x) => [x.p.id, { kind: "size" as const, size: x.n.size! }])) };
  }
  if (distinct(amounts) && sameAll(sizes)) {
    const common = sizes[0] ? ` ${SIZE_LABEL[sizes[0] as VariantSize]}` : "";
    return { name: `${base}${common}`, variants: new Map(parts.map((x) => [x.p.id, { kind: x.n.amount!.kind, amount: x.n.amount!.amount }])) };
  }
  return null;
}

/** Products that look like one product saved once per size: same name apart from the size or amount. */
export function suggestMerges(products: Product[]): Product[][] {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    if (hasVariants(p) || !p.name.trim()) continue;
    const n = parseName(p.name);
    if (!n.amount && !n.size) continue;
    const k = key(n.base);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.values()].filter((g) => planMerge(g) !== null).map((g) => g.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
}

const textOf = (html?: string) =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** The product whose page, photos and description the merged product keeps: the one with the most written about it. */
export function pickKeeper(products: Product[]): Product {
  const score = (p: Product) => textOf(p.description).length + textOf(p.specification).length + (p.images?.length ?? 0) * 50 + (p.featured ? 10 : 0);
  return products.reduce((best, p) => (score(p) > score(best) ? p : best), products[0]!);
}

/**
 * Descriptions (or specifications) of the merged products. When they say the same (or one says it all) that one is
 * kept; when they differ - e.g. food for small fish and for medium fish - each is kept under its variant's name.
 */
/** Whether these descriptions say different things (so merging keeps each one under its variant's name). */
export function textsDiffer(htmls: (string | undefined)[]): boolean {
  const filled = htmls.map(textOf).filter(Boolean);
  const longest = filled.reduce((a, b) => (b.length > a.length ? b : a), "");
  return !filled.every((t) => longest.includes(t));
}

export function mergeTexts(items: { label: string; html?: string }[]): string {
  const filled = items.filter((i) => textOf(i.html));
  if (!filled.length) return items.find((i) => i.html)?.html ?? "";
  const longest = filled.reduce((a, b) => (textOf(b.html).length > textOf(a.html).length ? b : a));
  if (!textsDiffer(filled.map((i) => i.html))) return longest.html!;
  const groups: { labels: string[]; html: string }[] = [];
  for (const i of filled) {
    const g = groups.find((x) => textOf(x.html) === textOf(i.html));
    if (g) g.labels.push(i.label);
    else groups.push({ labels: [i.label], html: i.html! });
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return groups.map((g) => `<h3>${esc(g.labels.join(", "))}</h3>${/<\/?[a-z][^>]*>/i.test(g.html) ? g.html : `<p>${esc(g.html).replace(/\r?\n/g, "<br>")}</p>`}`).join("");
}

/**
 * One product made from several: the keeper's id (so its address stays), every product as a variant that keeps its
 * own id, price, discount, purchase price, stock, weight, SKU and photo. Photos that are the same picture (`same` maps
 * a copy to the photo kept) are kept once. Returns the product and the ids of the products it replaces.
 */
export function mergeProducts(
  products: Product[],
  plan: { name: string; variants: Map<string, Pick3> },
  same: Map<string, string> = new Map(),
  now = Date.now(),
): { product: Product; removed: string[] } {
  const keep = pickKeeper(products);
  const photo = (src?: string) => (src ? (same.get(src) ?? src) : undefined);
  const ordered = [keep, ...products.filter((p) => p.id !== keep.id)];
  const images = [...new Set(ordered.flatMap((p) => (p.images ?? []).map((s) => photo(s)!)))];
  const variants: ProductVariant[] = sortVariants(
    products.map((p) => {
      const v = plan.variants.get(p.id)!;
      const out: ProductVariant = {
        id: p.id,
        kind: v.kind,
        ...(v.amount !== undefined ? { amount: v.amount } : {}),
        ...(v.size ? { size: v.size } : {}),
        price: p.price,
        ...((p.regularPrice ?? 0) > p.price ? { regularPrice: p.regularPrice } : {}),
        ...(p.purchasePrice !== undefined ? { purchasePrice: p.purchasePrice } : {}),
        ...(p.purchasePriceMax !== undefined ? { purchasePriceMax: p.purchasePriceMax } : {}),
        ...(p.inStock === false ? { inStock: false } : {}),
        ...(typeof p.stock === "number" ? { stock: p.stock, stockAt: p.stockAt } : {}),
        ...(p.weight ? { weight: p.weight } : {}),
        ...(p.sku?.trim() ? { sku: p.sku.trim() } : {}),
        ...(p.images?.[0] ? { image: photo(p.images[0]) } : {}),
      };
      return out;
    }),
  );
  const labelOf = (p: Product) => variantLabel(plan.variants.get(p.id)!);
  const firstFilled = (f: (p: Product) => string | undefined) => ordered.map(f).find((x) => x?.trim());
  const product: Product = {
    ...keep,
    name: plan.name.trim(),
    description: mergeTexts(sortedBy(products, plan).map((p) => ({ label: labelOf(p), html: p.description }))),
    specification: mergeTexts(sortedBy(products, plan).map((p) => ({ label: labelOf(p), html: p.specification }))),
    brand: firstFilled((p) => p.brand),
    category: firstFilled((p) => p.category),
    subcategory: keep.category?.trim() ? keep.subcategory : firstFilled((p) => p.subcategory),
    subsubcategory: keep.category?.trim() ? keep.subsubcategory : firstFilled((p) => p.subsubcategory),
    warranty: firstFilled((p) => p.warranty) ?? keep.warranty,
    sku: undefined,
    weight: undefined,
    images,
    featured: products.some((p) => p.featured) || undefined,
    onSite: products.some((p) => p.onSite !== false) ? undefined : false,
    updatedAt: now,
  };
  return { product: { ...product, ...withVariants(product, variants) }, removed: products.filter((p) => p.id !== keep.id).map((p) => p.id) };
}

const sortedBy = (products: Product[], plan: { variants: Map<string, Pick3> }) => {
  const order = sortVariants(products.map((p) => ({ id: p.id, ...plan.variants.get(p.id)! })));
  return order.map((o) => products.find((p) => p.id === o.id)!);
};
