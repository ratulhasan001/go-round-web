import type { Product, ProductGroup } from "./types";

/** The two halves of the admin's product list. Admin only: the website keeps its own categories. */
export const PRODUCT_GROUPS: { key: ProductGroup; label: string }[] = [
  { key: "plant", label: "Plants" },
  { key: "accessory", label: "Accessories" },
];

/**
 * Which half a product is listed in: the one the admin picked, otherwise a guess from its category (products added
 * before the split, or remembered from a receipt). An empty pot ("Plants pot") is an accessory.
 */
export const groupOf = (p: Product): ProductGroup =>
  p.group ?? (/^\s*(aquatic\s+)?plants?\s*$/i.test(p.category ?? "") ? "plant" : "accessory");
