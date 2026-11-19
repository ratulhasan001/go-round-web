import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isAuthed } from "@/lib/server/auth";
import { HOSTS, STORE_BASE, areaOf, isStorePath } from "@/lib/site";

// a staff code on the verify address: any single word of letters and digits (typed codes may be mistyped, in capitals or
// the wrong length - they still get the "can't verify" page), except the store's own page names
const STAFF_CODE = /^\/([a-z0-9]{6,40})\/?$/i;
const STORE_PAGES = new Set(["about", "account", "cart", "checkout", "contact", "faq", "products", "reviews", "verify"]);
// the only API routes the public addresses may call
const PUBLIC_API = (p: string) => p.startsWith("/api/site/") || p.startsWith("/api/img/") || p === "/api/shop-logo";

/**
 * One app, three addresses (see src/lib/site.ts):
 *   goroundbd.com         → the store, whose pages live under /store (so /products serves /store/products)
 *   verify.goroundbd.com  → the verify page (/store/verify), and /<code> → a staff member's verification page
 *   admin.goroundbd.com   → the admin panel, as below
 * The old *.vercel.app address only forwards to these. Any other address (localhost) serves everything on one
 * address: admin at the root, store under /store.
 *
 * Admin pages and API calls need the shop password, except the login page, the public customer form (/f/<token>, its
 * submit endpoint and the shop logo it shows), which is protected by its own one-time, 30-minute token, and the
 * customer website (/store…, its /api/site/… endpoints and product photos).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const area = areaOf(host);
  const api = pathname.startsWith("/api/");
  const to = (h: string, path: string) => NextResponse.redirect(`https://${h}${path}${search}`, 308);

  if (/^www\./i.test(host)) return to(host.replace(/^www\./i, "").split(":")[0]!, pathname);

  // the old *.vercel.app address is retired: every page moves to its own goroundbd.com address
  if (host.split(":")[0]!.toLowerCase().endsWith(".vercel.app")) {
    if (pathname === `${STORE_BASE}/verify` || pathname.startsWith(`${STORE_BASE}/verify/`)) return to(HOSTS.verify, pathname.slice(`${STORE_BASE}/verify`.length) || "/");
    if (isStorePath(pathname)) return to(HOSTS.store, pathname.slice(STORE_BASE.length) || "/");
    return to(HOSTS.admin, pathname);
  }

  // the shop's own data is only ever served on the admin address
  if ((area === "store" || area === "verify") && api && !PUBLIC_API(pathname)) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (area === "store" && !api) {
    // old /store/… links lose the prefix; the verify pages have their own address
    if (isStorePath(pathname)) return to(HOSTS.store, pathname.slice(STORE_BASE.length) || "/");
    if (pathname === "/verify" || pathname.startsWith("/verify/")) return to(HOSTS.verify, pathname.slice("/verify".length) || "/");
    return framing(pathname, NextResponse.rewrite(new URL(`${STORE_BASE}${pathname === "/" ? "" : pathname}${search}`, request.url)));
  }

  if (area === "verify" && !api) {
    if (pathname === "/") return NextResponse.rewrite(new URL(`${STORE_BASE}/verify${search}`, request.url));
    const staff = STAFF_CODE.exec(pathname);
    if (staff && !STORE_PAGES.has(staff[1]!.toLowerCase())) return NextResponse.rewrite(new URL(`${STORE_BASE}/verify/${staff[1]!.toLowerCase()}${search}`, request.url));
    return to(HOSTS.store, isStorePath(pathname) ? pathname.slice(STORE_BASE.length) || "/" : pathname); // anything else is a store page
  }

  if (area === "admin" && isStorePath(pathname)) return to(HOSTS.store, pathname.slice(STORE_BASE.length) || "/");

  if (pathname === "/login" || pathname.startsWith("/login/") || pathname === "/api/login" || pathname.startsWith("/api/login/") || pathname === "/api/logout") return NextResponse.next();
  if (pathname.startsWith("/f/") || pathname.startsWith("/api/f/")) return NextResponse.next();
  if (isStorePath(pathname)) return framing(pathname.slice(STORE_BASE.length), NextResponse.next());
  if (PUBLIC_API(pathname)) return NextResponse.next();
  // admin changes may only come from the admin's own pages: the store and verify addresses count as the "same site" to
  // the browser, so the session cookie alone wouldn't stop a script elsewhere on goroundbd.com from sending them
  if (api && request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin) {
      let from = "";
      try {
        from = new URL(origin).host.toLowerCase();
      } catch {
        /* not a URL */
      }
      if (from !== host.toLowerCase()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  if (await isAuthed(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (api) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

/**
 * The home page preview (/preview) takes its settings from the admin panel that frames it, so only the admin panel may
 * frame it - no other site can show its own text on the shop's address that way.
 */
function framing(storePath: string, res: NextResponse) {
  if (storePath === "/preview" || storePath.startsWith("/preview/")) res.headers.set("Content-Security-Policy", `frame-ancestors 'self' https://${HOSTS.admin}`);
  return res;
}

export const config = {
  // skip static files, fonts, icons and the logo so the login page can still load them
  matcher: ["/((?!_next/static|_next/image|fonts/|favicon.ico|icon.png|apple-icon.png|icon-192.png|icon-512.png|logo.png|manifest.webmanifest).*)"],
};
