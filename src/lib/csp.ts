import { type Area, HOSTS, PHOTO_BASE } from "./site";

/**
 * The one inline script of the site (src/app/layout.tsx). The policy allows it by its hash, so editing it here keeps
 * both in step.
 */
export const JS_CLASS_SCRIPT = "document.documentElement.classList.add('js')";

let scriptHash: Promise<string> | null = null;
const inlineScriptHash = () =>
  (scriptHash ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(JS_CLASS_SCRIPT))
    .then((b) => `'sha256-${btoa(String.fromCharCode(...new Uint8Array(b)))}'`));

/** A fresh, unguessable nonce for one page view. */
export function newNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

const TURNSTILE = "https://challenges.cloudflare.com"; // Cloudflare's "verify you are human" box (logins, sign-up)
const EMOJI = "https://cdnjs.cloudflare.com"; // emoji pictures react-pdf draws into the admin's PDFs
const PHOTOS = new URL(PHOTO_BASE).origin; // uploaded photos (Cloudflare R2): the ID-card builder reads team photos

/**
 * The Content-Security-Policy of a page: the browser runs only the scripts this page view's nonce allows (Next.js puts
 * it on its own scripts) and the ones they load, so script injected into a page - through a product description, say -
 * can't run. Styles may be inline (React writes style attributes); pictures may come from any https address.
 *
 * - `area`: the admin panel (and a dev address, which also serves it) builds PDFs in the browser, which needs
 *   WebAssembly and the emoji pictures, and frames the store's home page preview.
 * - `framedByAdmin`: the home page preview, which the admin panel shows in a frame.
 */
export async function contentSecurityPolicy(o: { nonce: string; area: Area; dev: boolean; framedByAdmin?: boolean }) {
  const admin = o.area === "admin" || o.area === "dev";
  const rules: Record<string, (string | false)[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': scripts the allowed ones add (page chunks, the Turnstile script) may run too. The rest are
    // fallbacks that browsers which understand nonces ignore: 'self' and the Turnstile address for browsers without
    // 'strict-dynamic' (Safari before 15.4), 'unsafe-inline' for very old ones that know no nonces at all - many
    // customers' phones are old, and without it Next.js's own inline scripts wouldn't run there
    "script-src": ["'self'", `'nonce-${o.nonce}'`, await inlineScriptHash(), "'strict-dynamic'", TURNSTILE, "'unsafe-inline'", admin && "'wasm-unsafe-eval'", o.dev && "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    // data: / blob: - the admin's Word, Excel and ID-card files read their own pictures (signature, logo, photos) back
    // as bytes this way; such an address already holds its data, so nothing can be sent anywhere through it
    "connect-src": ["'self'", "data:", "blob:", TURNSTILE, admin && EMOJI, admin && PHOTOS],
    "frame-src": ["'self'", TURNSTILE, admin && `https://${HOSTS.store}`],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": o.framedByAdmin ? ["'self'", `https://${HOSTS.admin}`] : ["'none'"],
    // anything blocked is logged by src/app/api/site/csp-report/route.ts
    "report-uri": ["/api/site/csp-report"],
  };
  return Object.entries(rules)
    .map(([k, v]) => [k, ...v.filter(Boolean)].join(" "))
    .join("; ");
}
