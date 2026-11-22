import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import {
  clampAmount,
  customName,
  sellable,
  specMissing,
  findVariant,
  leadVariant,
  mergeProducts,
  mergeTexts,
  parseName,
  planMerge,
  saleNames,
  sortVariants,
  suggestMerges,
  variantLabel,
  variantName,
  withVariants,
} from "@/lib/variants";
import { onSite, publicProduct } from "@/lib/site";

const prod = (id: string, name: string, price: number, more: Partial<Product> = {}): Product => ({ id, name, price, images: [`https://img.example/p/${id}`], ...more });

describe("variant labels", () => {
  it("reads like the shop writes sizes", () => {
    expect(variantLabel({ kind: "ml", amount: 500 })).toBe("500 ml");
    expect(variantLabel({ kind: "l", amount: 0.67 })).toBe("0.67 L");
    expect(variantLabel({ kind: "kg", amount: 2 })).toBe("2 kg");
    expect(variantLabel({ kind: "gm", amount: 100 })).toBe("100 gm");
    expect(variantLabel({ kind: "piece", amount: 1 })).toBe("1 piece");
    expect(variantLabel({ kind: "piece", amount: 3 })).toBe("3 pieces");
    expect(variantLabel({ kind: "pot", amount: 2 })).toBe("2 pots");
    expect(variantLabel({ kind: "size", size: "large" })).toBe("Large");
    expect(variantLabel({ kind: "bag" })).toBe("Full bag");
    expect(variantName(" APT Zero ", { kind: "ml", amount: 200 })).toBe("APT Zero - 200 ml");
  });

  it("takes a custom name the admin types", () => {
    expect(variantLabel({ kind: "custom", name: "  Red   tank  " })).toBe("Red tank");
    expect(variantName("Moss ball", { kind: "custom", name: "Pack of 3" })).toBe("Moss ball - Pack of 3");
    expect(customName("x".repeat(60))).toHaveLength(40);
    // no name yet: not shown to customers, and the admin is told why
    expect(specMissing({ kind: "custom", name: "  " })).toBe("a name");
    expect(sellable({ id: "c", kind: "custom", name: " ", price: 100 })).toBe(false);
    expect(sellable({ id: "c", kind: "custom", name: "Red", price: 100 })).toBe(true);
    expect(specMissing({ kind: "ml" })).toBe("an amount");
    expect(specMissing({ kind: "bag" })).toBe("");
  });

  it("keeps amounts inside each kind's range", () => {
    expect(clampAmount("kg", 25)).toBe(20);
    expect(clampAmount("kg", 0.5)).toBe(0.5); // fractions of a kg or litre are fine
    expect(clampAmount("ml", 2.4)).toBe(2); // whole millilitres
    expect(clampAmount("piece", 0.4)).toBe(1);
    expect(clampAmount("pot", 11)).toBe(10);
    expect(clampAmount("ml", 0)).toBeUndefined();
    expect(clampAmount("size", 3)).toBeUndefined();
  });

  it("sorts by kind, then smallest first", () => {
    const list = sortVariants([
      { kind: "size" as const, size: "large" as const },
      { kind: "ml" as const, amount: 500 },
      { kind: "size" as const, size: "small" as const },
      { kind: "ml" as const, amount: 100 },
      { kind: "kg" as const, amount: 1 },
    ]);
    expect(list.map(variantLabel)).toEqual(["1 kg", "100 ml", "500 ml", "Small", "Large"]);
    // custom names come last, in the order they were added
    const named = sortVariants([
      { kind: "custom" as const, name: "Red" },
      { kind: "ml" as const, amount: 100 },
      { kind: "custom" as const, name: "Blue" },
    ]);
    expect(named.map(variantLabel)).toEqual(["100 ml", "Red", "Blue"]);
  });
});

describe("reading sizes from product names", () => {
  it.each([
    ["APT  Fix--500 ml", "APT Fix", "500 ml"],
    ["Seachem Prime 325ml", "Seachem Prime", "325 ml"],
    ["ADA Amazonia Soil Version2  -0.67 liter", "ADA Amazonia Soil Version2", "0.67 L"],
    ["Netlia Aqua soil 9 litter", "Netlia Aqua soil", "9 L"],
    ["Seachem Matrix-100 gm", "Seachem Matrix", "100 gm"],
    ["Co2 Cylinder-5 kg", "Co2 Cylinder", "5 kg"],
    ["Dr tank ground fertilizer -130 gm ", "Dr tank ground fertilizer", "130 gm"],
  ])("%s", (name, base, label) => {
    const n = parseName(name);
    expect(n.base).toBe(base);
    expect(n.amount && variantLabel(n.amount)).toBe(label);
  });

  it("finds sizes written as words or letters", () => {
    expect(parseName("Magnetic glass cleaner L Size")).toEqual({ base: "Magnetic glass cleaner", size: "large" });
    expect(parseName("Magnetic glass cleaner M size")).toEqual({ base: "Magnetic glass cleaner", size: "medium" });
    expect(parseName("AQUAPRO NANO CO2 Diffuser M")).toEqual({ base: "AQUAPRO NANO CO2 Diffuser", size: "medium" });
    expect(parseName("Bog wood  big -1kg")).toEqual({ base: "Bog wood", size: "large", amount: { kind: "kg", amount: 1 } });
    expect(parseName("API  Tropical Treats Small- 70 gm")).toEqual({ base: "API Tropical Treats", size: "small", amount: { kind: "gm", amount: 70 } });
  });

  it("leaves names without a variant alone", () => {
    expect(parseName("Neo Helios xp-450")).toEqual({ base: "Neo Helios xp-450" });
    expect(parseName("Aqua Pro-Thermometer-10 mm").amount).toBeUndefined();
    expect(parseName("Osmocot capsule 15 piece pack").amount).toBeUndefined(); // more pieces than a variant takes
  });
});

describe("suggested merges", () => {
  const list = [
    prod("a1", "APT  Zero-200 ml", 1499),
    prod("a2", "APT  Zero-300 ml", 2249),
    prod("a3", "APT  Zero-500 ml", 2699),
    prod("a4", "APT  Zero-100 ml", 1049),
    prod("t1", "API  Tropical Treats Small- 70 gm", 449),
    prod("t2", "API  Tropical Treats  Medium-  70 gm", 449),
    prod("b1", "Bog wood  big -1kg", 2199),
    prod("b2", "Bog wood small-1kg", 2599),
    prod("c1", "Co2 Cylinder-5 kg", 2999),
    prod("c2", "Co2 Cylinder Iron Body-2 kg", 3799), // another kind of cylinder: not the same product
    prod("n1", "Neo Helios xp-450", 2199),
    prod("n2", "Neo Helios xp-600", 2499), // models, not sizes
    prod("l1", "Lava rock black-1kg", 449),
    prod("l2", "Lava rock red-1kg", 449), // colours, not sizes
  ];

  it("groups the same product in different sizes, and nothing else", () => {
    const groups = suggestMerges(list).map((g) => g.map((p) => p.id).sort());
    expect(groups).toEqual(expect.arrayContaining([["a1", "a2", "a3", "a4"], ["t1", "t2"], ["b1", "b2"]]));
    expect(groups).toHaveLength(3);
  });

  it("names the merged product and its variants", () => {
    const zero = planMerge(list.filter((p) => p.id.startsWith("a")))!;
    expect(zero.name).toBe("APT Zero");
    expect([...zero.variants.values()].map(variantLabel).sort()).toEqual(["100 ml", "200 ml", "300 ml", "500 ml"]);
    // same amount, different sizes: the size is the variant and the amount stays in the name
    const treats = planMerge(list.filter((p) => p.id.startsWith("t")))!;
    expect(treats.name).toBe("API Tropical Treats - 70 gm");
    expect(treats.variants.get("t2")).toEqual({ kind: "size", size: "medium" });
    expect(planMerge(list.filter((p) => p.id.startsWith("b")))!.name).toBe("Bog wood - 1 kg");
  });
});

describe("merging products into one", () => {
  const a = prod("p200", "APT  Zero-200 ml", 1499, { regularPrice: 1600, purchasePrice: 1000, description: "<p>All in one fertiliser.</p>", featured: true, category: "Fertilizer", brand: "APT" });
  const b = prod("p500", "APT  Zero-500 ml", 2699, { regularPrice: 2800, purchasePrice: 1900, purchasePriceMax: 2000, description: "<p>All in one fertiliser.</p>", weight: 0.6, images: ["https://img.example/p/p500", "https://img.example/p/extra"] });
  const c = prod("p300", "APT  Zero-300 ml", 2249, { inStock: false, stock: 0, stockAt: 5, description: "", sku: "Z300" });
  // p200's photo and p300's photo are the same picture
  const same = new Map([["https://img.example/p/p300", "https://img.example/p/p200"]]);
  const plan = planMerge([a, b, c])!;
  const { product, removed } = mergeProducts([a, b, c], plan, same, 42);

  it("keeps one product, with every size as a variant that keeps its own details", () => {
    expect(product.name).toBe("APT Zero");
    expect(removed.sort()).toEqual([product.id === "p500" ? "p200" : "p500", "p300"].sort());
    expect(product.variants!.map((v) => [v.id, variantLabel(v), v.price])).toEqual([
      ["p200", "200 ml", 1499],
      ["p300", "300 ml", 2249],
      ["p500", "500 ml", 2699],
    ]);
    const v500 = product.variants!.find((v) => v.id === "p500")!;
    expect(v500).toMatchObject({ regularPrice: 2800, purchasePrice: 1900, purchasePriceMax: 2000, weight: 0.6, image: "https://img.example/p/p500" });
    const v300 = product.variants!.find((v) => v.id === "p300")!;
    expect(v300).toMatchObject({ inStock: false, stock: 0, sku: "Z300", image: "https://img.example/p/p200" });
  });

  it("keeps each picture once and the shared details", () => {
    expect(new Set(product.images).size).toBe(product.images!.length);
    expect(product.images).toHaveLength(3); // p200 (also p300's), p500, extra
    expect(product).toMatchObject({ featured: true, category: "Fertilizer", brand: "APT", description: "<p>All in one fertiliser.</p>", updatedAt: 42 });
    // product-level price follows the cheapest variant in stock; stock and purchase price live on the variants
    expect(product).toMatchObject({ price: 1499, regularPrice: 1600, inStock: true });
    expect(product.purchasePrice).toBeUndefined();
    expect(product.stock).toBeUndefined();
  });

  it("keeps different descriptions under each variant's name", () => {
    expect(mergeTexts([{ label: "Small", html: "<p>For small fish.</p>" }, { label: "Medium", html: "For medium fish." }])).toBe("<h3>Small</h3><p>For small fish.</p><h3>Medium</h3><p>For medium fish.</p>");
    expect(mergeTexts([{ label: "Small", html: "Fish food" }, { label: "Medium", html: "<p>Fish food for everyone</p>" }])).toBe("<p>Fish food for everyone</p>");
  });

  it("gives receipts every name it's sold under, and finds old cart lines", () => {
    expect(saleNames(product)).toEqual(["APT Zero", "APT Zero - 200 ml", "APT Zero - 300 ml", "APT Zero - 500 ml"]);
    expect(findVariant(product, "p300")?.price).toBe(2249);
    expect(findVariant(product)?.id).toBe(product.id); // a line saved before the merge, for the product kept
  });
});

describe("variants on the website", () => {
  const base = prod("x", "Tropica Soil", 0, { category: "Soil" });
  const p: Product = {
    ...base,
    ...withVariants(base, [
      { id: "v9", kind: "l", amount: 9, price: 5699, regularPrice: 6000, weight: 9 },
      { id: "v1", kind: "l", amount: 0.67, price: 799, inStock: false },
      { id: "v3", kind: "l", amount: 3, price: 2499, stock: 4 },
      { id: "v0", kind: "l", amount: 5, price: 0 }, // no price yet: not shown
    ]),
  };

  it("leads with the cheapest variant in stock", () => {
    expect(leadVariant(p.variants!)?.id).toBe("v3");
    expect(p).toMatchObject({ price: 2499, inStock: true });
    expect(onSite(p)).toBe(true);
  });

  it("shows only variants with a price, smallest first", () => {
    const pub = publicProduct(p);
    expect(pub.variants.map((v) => v.label)).toEqual(["0.67 L", "3 L", "9 L"]);
    expect(pub.variants[0]).toMatchObject({ id: "v1", inStock: false });
    expect(pub.variants[2]).toMatchObject({ price: 5699, regularPrice: 6000, weight: 9 });
    expect(pub).toMatchObject({ price: 2499, priceTo: 5699, options: 3, inStock: true, stock: null });
  });

  it("shows custom names, and leaves out a custom variant without one", () => {
    const moss = prod("m", "Moss ball", 0);
    const pub = publicProduct({
      ...moss,
      ...withVariants(moss, [
        { id: "m1", kind: "custom", name: "Single", price: 150 },
        { id: "m3", kind: "custom", name: "Pack of 3", price: 400 },
        { id: "m0", kind: "custom", name: "", price: 999 },
      ]),
    });
    expect(pub.variants.map((v) => [v.label, v.price])).toEqual([
      ["Single", 150],
      ["Pack of 3", 400],
    ]);
    expect(pub).toMatchObject({ price: 150, priceTo: 400 });
  });

  it("sells a product out when every variant is", () => {
    const out = { ...p, ...withVariants(p, p.variants!.map((v) => ({ ...v, inStock: false }))) };
    expect(out.inStock).toBe(false);
    expect(publicProduct(out).inStock).toBe(false);
  });
});
