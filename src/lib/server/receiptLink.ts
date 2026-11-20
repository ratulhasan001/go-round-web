import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// A customer's receipt is downloaded with a plain link (a GET the browser saves as a file), because that works in
// every phone browser - but the link mustn't need the mobile number in it. So it carries the order code, an expiry and
// a signature; the order page asks for a fresh link (POST /api/site/receipt, with the number) each time it opens.

const VALID_DAYS = 7;

const key = () => createHash("sha256").update(`gr-receipt-link\u0000${process.env.SESSION_SECRET || process.env.DATABASE_URL || ""}`).digest();
const signature = (code: string, expires: number) => createHmac("sha256", key()).update(`${code}\u0000${expires}`).digest("base64url").slice(0, 32);

/** The download address of an order's receipt, e.g. /api/site/receipt/GR-0023.pdf?o=…&e=…&t=… */
export function receiptLink(code: string, number: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + VALID_DAYS * 86400;
  const file = `${number.replace(/[^\w-]+/g, "_") || "receipt"}.pdf`; // named for browsers that ignore the file name sent
  return `/api/site/receipt/${file}?${new URLSearchParams({ o: code, e: String(expires), t: signature(code, expires) })}`;
}

/** True when this code, expiry and signature came from receiptLink() and haven't expired. */
export function receiptLinkValid(code: string, expires: string, sig: string, now = Date.now()) {
  const e = Number(expires);
  if (!code || !sig || !Number.isSafeInteger(e) || e * 1000 < now) return false;
  const want = Buffer.from(signature(code, e));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
