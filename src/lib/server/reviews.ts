import { randomUUID } from "node:crypto";
import { clean } from "@/lib/phone";
import { siteSettings } from "@/lib/site";
import type { Product, Review } from "@/lib/types";
import { db, dbEnabled, ensureSchema } from "./db";
import { loadShop } from "./catalog";

/** What the website shows of a review: never whether it was typed in by the shop, nor the name on an anonymous one. */
export interface PublicReview {
  id: string;
  productId: string;
  productName: string;
  name: string;
  rating: number;
  text: string;
  createdAt: number;
}

const view = (r: Review): PublicReview => ({
  id: r.id,
  productId: r.productId,
  productName: r.productName ?? "",
  name: r.anonymous || !r.name.trim() ? "Anonymous" : r.name,
  rating: r.rating,
  text: r.text,
  createdAt: r.createdAt,
});

/** Approved reviews, newest first: for one product, or the newest across the shop. */
export async function loadReviews(productId?: string, limit = 50): Promise<PublicReview[]> {
  if (!dbEnabled()) return [];
  try {
    await ensureSchema();
    const rows = productId
      ? await db()<{ data: Review }[]>`
          select data from gr_docs where kind = 'review' and data->>'productId' = ${productId} and (data->>'approved')::boolean
          order by (data->>'createdAt')::bigint desc limit ${limit}`
      : await db()<{ data: Review }[]>`
          select data from gr_docs where kind = 'review' and (data->>'approved')::boolean
          order by (data->>'createdAt')::bigint desc limit ${limit}`;
    return rows.map((r) => view(r.data));
  } catch (e) {
    console.error("reviews failed", e);
    return [];
  }
}

export class ReviewError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.error));
  }
}

/** A review written on the website. It goes live at once, or waits for the shop, as the Website settings say. */
export async function addReview(body: Record<string, unknown>, opts: { hold?: boolean } = {}): Promise<{ review: PublicReview; approved: boolean }> {
  // a customer can post without their name: it shows as "Anonymous" (a name typed anyway is kept for the shop only)
  const anonymous = body.anonymous === true;
  const name = clean(body.name).slice(0, 60);
  const text = String(body.text ?? "").trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").slice(0, 1000);
  const rating = Math.round(Number(body.rating));
  const productId = typeof body.productId === "string" ? body.productId.slice(0, 100) : "";
  const fields: Record<string, string> = {};
  if (!anonymous && name.length < 2) fields.name = "Please enter your name, or post anonymously.";
  if (!(rating >= 1 && rating <= 5)) fields.rating = "Please pick 1 to 5 stars.";
  if (text.length < 3) fields.text = "Please write a few words.";
  if (Object.keys(fields).length) throw new ReviewError(422, { error: "invalid", fields });

  await ensureSchema();
  const [row] = productId ? await db()<{ data: Product }[]>`select data from gr_docs where kind = 'product' and id = ${productId}` : [];
  if (productId && !row) throw new ReviewError(404, { error: "not found", message: "This product isn't on the website any more." });
  const settings = siteSettings(await loadShop());
  const now = Date.now();
  const review: Review = {
    id: randomUUID(),
    productId,
    ...(row ? { productName: row.data.name.trim() } : {}),
    name,
    ...(anonymous ? { anonymous: true } : {}),
    rating,
    text,
    approved: settings.autoApproveReviews && !opts.hold,
    source: "customer",
    createdAt: now,
    updatedAt: now,
  };
  await db()`insert into gr_docs (kind, id, data) values ('review', ${review.id}, ${db().json(review as never)})`;
  return { review: view(review), approved: review.approved };
}
