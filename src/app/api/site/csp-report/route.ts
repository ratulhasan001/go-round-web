export const dynamic = "force-dynamic";

// Browsers report here whatever the Content-Security-Policy blocked (src/lib/csp.ts, `report-uri`), so a page the
// policy breaks shows up in the server log ("CSP blocked"). Anyone can post here, and browser add-ons trigger reports
// too, so only a short summary is logged - the page's path (no query), the rule and the blocked address's origin - at
// most LIMIT a minute, and nothing is stored.

const LIMIT = 30;
let minute = 0;
let logged = 0;

const origin = (u: unknown) => {
  const s = String(u ?? "");
  if (!/^https?:/i.test(s)) return s.slice(0, 40); // "inline", "eval", "data", "blob"…
  try {
    return new URL(s).origin;
  } catch {
    return "?";
  }
};
const path = (u: unknown) => {
  try {
    return new URL(String(u)).pathname.slice(0, 120);
  } catch {
    return "?";
  }
};

export async function POST(req: Request) {
  const now = Math.floor(Date.now() / 60000);
  if (now !== minute) [minute, logged] = [now, 0];
  if (logged >= LIMIT) return new Response(null, { status: 204 });
  try {
    const text = (await req.text()).slice(0, 8000);
    const r = (JSON.parse(text) as { "csp-report"?: Record<string, unknown> })["csp-report"];
    if (r) {
      logged++;
      console.warn("CSP blocked", {
        page: path(r["document-uri"]),
        rule: String(r["effective-directive"] ?? r["violated-directive"] ?? "").slice(0, 40),
        blocked: origin(r["blocked-uri"]),
        source: origin(r["source-file"]),
        line: Number(r["line-number"]) || undefined,
      });
    }
  } catch {
    /* not a report */
  }
  return new Response(null, { status: 204 });
}
