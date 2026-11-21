// The visitor counter's rules: when a page view starts a visit, who counts as a visitor, and the days the admin sees.
import { describe, expect, it } from "vitest";
import { VISIT_GAP_MS, isBot, lastDays, visitStep } from "@/lib/visits";

const now = Date.parse("2026-11-21T10:00:00Z");

describe("visitStep", () => {
  it("counts a browser seen for the first time as a visit and a new visitor", () => {
    expect(visitStep(null, now, "2026-11-21")).toEqual({ visit: true, first: true, next: { day: "2026-11-21", last: now } });
  });

  it("counts the next page views of the same visit as nothing", () => {
    expect(visitStep({ day: "2026-11-21", last: now - 5 * 60_000 }, now, "2026-11-21")).toMatchObject({ visit: false, first: false });
    expect(visitStep({ day: "2026-11-21", last: now - VISIT_GAP_MS }, now, "2026-11-21")).toMatchObject({ visit: false });
  });

  it("starts a new visit (same visitor) after half an hour away", () => {
    expect(visitStep({ day: "2026-11-21", last: now - VISIT_GAP_MS - 1 }, now, "2026-11-21")).toMatchObject({ visit: true, first: false });
  });

  it("counts the visitor again on a new day, even mid-visit", () => {
    expect(visitStep({ day: "2026-11-20", last: now - 60_000 }, now, "2026-11-21")).toMatchObject({ visit: true, first: true });
  });

  it("treats damaged memory or a clock set back as a fresh start, never as no visit forever", () => {
    expect(visitStep({ day: 5, last: "x" }, now, "2026-11-21")).toMatchObject({ visit: true, first: true });
    expect(visitStep("nonsense", now, "2026-11-21")).toMatchObject({ visit: true, first: true });
    expect(visitStep({ day: "2026-11-21", last: now + 3_600_000 }, now, "2026-11-21")).toMatchObject({ visit: true, first: false });
  });
});

describe("isBot", () => {
  it("leaves people's browsers in, including a phone with 'bot' in its name", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Linux; Android 12; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US;FBAV/400.0]",
    ])
      expect(isBot(ua), ua).toBe(false);
  });

  it("keeps search engines, speed tests and scripts out", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "curl/8.7.1",
      "python-requests/2.32",
      "",
    ])
      expect(isBot(ua), ua).toBe(true);
  });
});

describe("lastDays", () => {
  it("lists the days up to today, oldest first, across a month end", () => {
    expect(lastDays("2026-12-02", 4)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(lastDays("2026-11-21", 30)).toHaveLength(30);
    expect(lastDays("2026-11-21", 30)[0]).toBe("2026-10-23");
  });
});
