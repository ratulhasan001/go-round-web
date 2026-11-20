"use client";

import { useState } from "react";
import { Loader2, MessageSquarePlus, Star } from "lucide-react";
import type { PublicReview } from "@/lib/server/reviews";
import { avgRating } from "@/lib/site";
import { useShop } from "./StoreContext";
import { SeaField, SeaInput, SeaTextarea, btn, cx } from "./ui";


export function Stars({ value, className, size = "size-4" }: { value: number; className?: string; size?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} aria-label={`${Math.round(value * 10) / 10} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cx(size, i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-sea-line text-sea-line")} aria-hidden />
      ))}
    </span>
  );
}

// always in Bangladesh time, so the server and the browser print the same date
const when = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export function ReviewCard({ r, showProduct }: { r: PublicReview; showProduct?: boolean }) {
  return (
    <figure className="flex h-full flex-col rounded-[22px] border border-sea-line bg-sea-paper p-5">
      <Stars value={r.rating} />
      <blockquote className="mt-3 flex-1 whitespace-pre-line text-[14.5px] leading-relaxed text-sea-body">{r.text}</blockquote>
      <figcaption className="mt-4 text-[13px]">
        <span className="font-extrabold text-sea-ink">{r.name}</span>
        <span className="text-sea-muted"> · {when(r.createdAt)}</span>
        {showProduct && r.productName && <span className="mt-0.5 block truncate font-semibold text-sea-leaf">{r.productName}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * A product's reviews, and the form customers write one with. With `page` (the Customer reviews page) it lists every
 * review in the shop, says which product each is about, and the form reviews the shop itself (productId "").
 */
export function ProductReviews({ productId, initial, page }: { productId: string; initial: PublicReview[]; page?: boolean }) {
  const { online } = useShop();
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", anonymous: false, rating: 0, text: "", gr_hp: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const avg = avgRating(list);
  const Heading = page ? "h1" : "h2";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/site/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, productId }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.review) {
        if (b.approved) setList((l) => [b.review, ...l]);
        setDone(b.approved ? "Thank you! Your review is up." : "Thank you! Your review will appear once we've checked it.");
        setF({ name: "", anonymous: false, rating: 0, text: "", gr_hp: "" });
        setOpen(false);
      } else if (b.fields) setErrors(b.fields);
      else setErrors({ form: b.message ?? `Something went wrong (error ${res.status}). Please try again.` });
    } catch {
      setErrors({ form: "You seem to be offline. Check your connection and try again." });
    }
    setBusy(false);
  };

  return (
    <section className={page ? "" : "mt-20"} id="reviews" aria-labelledby="reviews-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {page && <p className="store-eyebrow mb-3">Reviews</p>}
          <Heading id="reviews-h" className={page ? "font-serif text-[38px] leading-[1.04] sm:text-[52px]" : "font-serif text-[30px] sm:text-[38px]"}>
            Customer <em className="text-sea-teal">reviews</em>
          </Heading>
          <p className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-sea-body">
            {list.length ? (
              <>
                <Stars value={avg} /> {avg.toFixed(1)} out of 5 · {list.length} review{list.length === 1 ? "" : "s"}
              </>
            ) : (
              "No reviews yet - be the first to share how it went."
            )}
          </p>
        </div>
        {online && !open && (
          <button onClick={() => setOpen(true)} className={btn("outline", "md")}>
            <MessageSquarePlus className="size-4" /> Write a review
          </button>
        )}
      </div>
      {done && (
        <p role="status" className="mt-5 rounded-2xl bg-sea-leaf/10 px-4 py-3 text-[14px] font-semibold text-sea-ink">
          {done}
        </p>
      )}
      {open && (
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4 rounded-[24px] border border-sea-line bg-sea-paper p-5 sm:grid-cols-2 sm:p-6">
          <SeaField label="Your rating" error={errors.rating} className="sm:col-span-2">
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" role="radio" aria-checked={f.rating === i} aria-label={`${i} star${i === 1 ? "" : "s"}`} onClick={() => setF((x) => ({ ...x, rating: i }))} className="grid size-11 place-items-center rounded-full transition hover:bg-sea-sand/60 active:scale-90">
                  <Star className={cx("size-7", i <= f.rating ? "fill-amber-400 text-amber-400" : "text-sea-muted")} />
                </button>
              ))}
            </div>
          </SeaField>
          <div>
            <SeaField label={f.anonymous ? "Your name (not shown)" : "Your name"} error={errors.name} htmlFor="r-name">
              <SeaInput
                id="r-name"
                value={f.name}
                onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))}
                autoComplete="name"
                placeholder={f.anonymous ? "Optional - only we see it" : undefined}
                invalid={!!errors.name}
              />
            </SeaField>
            {/* post without a name: the review shows as "Anonymous" */}
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-sea-body">
              <input
                type="checkbox"
                checked={f.anonymous}
                onChange={(e) => {
                  setF((x) => ({ ...x, anonymous: e.target.checked }));
                  setErrors((er) => ({ ...er, name: "" }));
                }}
                className="size-4 accent-[#113A2D]"
              />
              Post anonymously
            </label>
          </div>
          <SeaField label="Your review" error={errors.text} className="sm:col-span-2" htmlFor="r-text">
            <SeaTextarea id="r-text" rows={4} value={f.text} onChange={(e) => setF((x) => ({ ...x, text: e.target.value }))} placeholder={page ? "How was your order, the products and our service?" : "How did it work in your tank?"} invalid={!!errors.text} />
          </SeaField>
          <input name="gr_hp" value={f.gr_hp} onChange={(e) => setF((x) => ({ ...x, gr_hp: e.target.value }))} tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" className="absolute -left-[9999px] size-px opacity-0" aria-hidden />
          {errors.form && <p className="text-[13px] font-semibold text-red-600 sm:col-span-2">{errors.form}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={btn("primary", "md")}>
              {busy && <Loader2 className="size-4 animate-spin" />} Post review
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btn("ghost", "md")}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {list.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <ReviewCard key={r.id} r={r} showProduct={page} />
          ))}
        </div>
      )}
    </section>
  );
}
