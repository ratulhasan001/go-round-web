import { HOSTS } from "@/lib/site";
import { SITE_URL } from "@/lib/seo";

// IndexNow: tells Bing (which also feeds Yahoo, DuckDuckGo and ChatGPT's web search) - and Yandex, Seznam and Naver -
// about new and changed store pages straight away, instead of waiting for their crawlers. The key proves the site is
// ours; it is public by design and is served at /indexnow.txt (public/indexnow.txt).
export const INDEXNOW_KEY = "267e5c8e09140ea4f8d704ad60677dba";

/** Tells search engines these store pages (paths like "/products/…") are new or changed. Only from the live site. */
export async function submitToIndexNow(paths: string[]) {
  if (process.env.VERCEL_ENV !== "production") return;
  const urlList = [...new Set(paths)].slice(0, 10_000).map((p) => `${SITE_URL}${p}`);
  if (!urlList.length) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOSTS.store, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/indexnow.txt`, urlList }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) console.warn("IndexNow answered", res.status);
  } catch (e) {
    console.warn("IndexNow failed", e);
  }
}
