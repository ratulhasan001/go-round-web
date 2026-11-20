import type { Shop } from "./types";

// The shop's contact details printed on the letterhead, receipts and ID cards. Kept apart from letter.ts (browser only)
// so the server can build customers' receipt PDFs with them too.

/** The letterhead's contact block, under the shop name (and in the footer). */
export const LETTERHEAD_ADDRESS = "Dhaka/Khulna, Bangladesh";
export const LETTERHEAD_PHONE = "+8801309372143";
/** The support address printed on the letterhead, receipts and ID cards (an empty saved email falls back to it). */
export const SUPPORT_EMAIL = "contact@goroundbd.com";
export const supportEmail = (shop: Pick<Shop, "email">) => shop.email?.trim() || SUPPORT_EMAIL;
export const contactLines = (shop: Shop) =>
  [`Address: ${LETTERHEAD_ADDRESS}`, `Contact: ${LETTERHEAD_PHONE}`, [`Support: ${supportEmail(shop)}`, shop.website].filter(Boolean).join("  ·  ")];

/** The contact block on receipts (bill copies), one line each - the same details as the letterhead. */
export const billLines = (shop: Pick<Shop, "email">) => [`Address: ${LETTERHEAD_ADDRESS}`, `Contact: ${LETTERHEAD_PHONE}`, `Support: ${supportEmail(shop)}`];
