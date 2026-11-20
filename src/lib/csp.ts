import { type Area, HOSTS } from "./site";

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
    // 'strict-dynamic': scripts the allowed ones add (page chunks, the Turnstile script) may run too. 'self' and the
    // Turnstile address are for older browsers that don't know 'strict-dynamic' (newer ones ignore them)
    "script-src": ["'self'", `'nonce-${o.nonce}'`, await inlineScriptHash(), "'strict-dynamic'", TURNSTILE, admin && "'wasm-unsafe-eval'", o.dev && "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", TURNSTILE, admin && EMOJI],
    "frame-src": ["'self'", TURNSTILE, admin && `https://${HOSTS.store}`],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": o.framedByAdmin ? ["'self'", `https://${HOSTS.admin}`] : ["'none'"],
  };
  return Object.entries(rules)
    .map(([k, v]) => [k, ...v.filter(Boolean)].join(" "))
    .join("; ");
}
