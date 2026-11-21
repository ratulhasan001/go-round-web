// The store's visitor counter, shared by the store (which tells the server about a new visit), the server (which adds
// it to the day's totals) and the admin panel (which shows them). Only totals per day are kept: no cookies, no internet
// addresses, nothing that tells one visitor from another. A browser remembers just the day and time of its last page
// view, so it is counted once a day as a visitor, and again as a visit after half an hour away.

/** One day's totals (a Bangladesh date, yyyy-mm-dd). */
export interface VisitDay {
  day: string;
  visitors: number; // different browsers that opened the store that day
  visits: number; // their visits: a new one starts after half an hour without opening a page
}

/** A visit ends after this long without opening a page (as most visitor counters count it). */
export const VISIT_GAP_MS = 30 * 60_000;

/** What a browser remembers between page views: the day it was last counted and its last page view. */
export interface VisitMemory {
  day: string;
  last: number;
}

/** Whether this page view starts a visit (and is the browser's first visit today), and what to remember next. */
export function visitStep(saved: unknown, now: number, today: string): { visit: boolean; first: boolean; next: VisitMemory } {
  const s = saved as Partial<VisitMemory> | null;
  const known = !!s && typeof s.day === "string" && typeof s.last === "number" && Number.isFinite(s.last);
  const first = !known || s.day !== today;
  // a clock set back (last in the future) also starts a visit, so a wrong clock can't stop the counting
  const visit = first || now - s.last! > VISIT_GAP_MS || now < s.last!;
  return { visit, first, next: { day: today, last: now } };
}

/**
 * Search engines, speed tests and scripts that run the page's code - not people. (Link previews and uptime checks never
 * run it, so they never send a visit.) Kept to clear names: some phones have "bot" in theirs (Cubot).
 */
const BOT =
  /googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|petalbot|ahrefs|semrush|mj12bot|bytespider|gptbot|claudebot|facebookexternalhit|slurp|bot\/|crawler|spider|headless|lighthouse|pagespeed|gtmetrix|pingdom|python|curl|wget|go-http|node-fetch|axios/i;
export const isBot = (userAgent: string) => !userAgent.trim() || BOT.test(userAgent);

/** The `n` dates (yyyy-mm-dd) up to and including `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}
