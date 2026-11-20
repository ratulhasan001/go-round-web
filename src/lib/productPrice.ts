import type { Product } from "./types";

// A product's prices, shared by the product list and the product form so both edit them the same way.
//   price         what the customer pays (the sale price when there is a discount) - "Unit price"
//   regularPrice  the price before the discount, shown crossed out; only set while there is a discount
//   purchasePrice what the shop paid (admin only); purchasePriceMax makes it a range, e.g. 1200 - 1500

type Prices = Pick<Product, "price" | "regularPrice">;

/** Whether the product is on discount (its regular price is above what customers pay). */
export const isDiscounted = (p: Prices) => (p.regularPrice ?? 0) > p.price;

/** The price before any discount ("Regular price"): the crossed-out price, or the price itself. */
export const regularOf = (p: Prices) => (isDiscounted(p) ? p.regularPrice! : p.price);

/**
 * New regular price `v`. A discounted product keeps its sale price while `v` is still above it; otherwise there is no
 * discount and `v` is simply the price.
 */
export const withRegular = (p: Prices, v: number): Partial<Product> => (isDiscounted(p) && p.price < v ? { regularPrice: v } : { price: v, regularPrice: undefined });

/**
 * New price customers pay `v` ("Unit price"). A discounted product stays discounted while `v` is below its regular
 * price; at or above it the discount ends. (A discount is started in the product form's "Discounted price".)
 */
export const withUnitPrice = (p: Prices, v: number): Partial<Product> => (isDiscounted(p) && v < p.regularPrice! ? { price: v } : { price: v, regularPrice: undefined });

/** The top of the purchase price range, or undefined when the purchase price is a single figure. */
export const purchaseMax = (p: Pick<Product, "purchasePrice" | "purchasePriceMax">) =>
  p.purchasePriceMax && p.purchasePriceMax > (p.purchasePrice ?? 0) ? p.purchasePriceMax : undefined;

/** A purchase price range from its two ends (the top is dropped when it isn't above the bottom). */
export const withPurchase = (from: number | undefined, to: number | undefined): Partial<Product> => ({
  purchasePrice: from,
  purchasePriceMax: to !== undefined && to > (from ?? 0) ? to : undefined,
});
