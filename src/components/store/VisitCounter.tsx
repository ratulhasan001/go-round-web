"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bdToday } from "@/lib/couponRules";
import { areaOf } from "@/lib/site";
import { visitStep } from "@/lib/visits";

const KEY = "gr-visit";
let countedWithoutStorage = false; // a browser that can't remember anything is counted once per page load

/**
 * Counts the store's visits for the admin panel (Website → Visitors): when a page view starts a visit, it tells the
 * server - once, without waiting for an answer, after the page has shown. The browser keeps only the day and time of
 * its last page view (no cookie, no id), so it can't be told apart from any other. Not counted: the home page preview
 * in the admin panel, the verify address, and automated browsers.
 */
export function VisitCounter() {
  const path = usePathname();
  useEffect(() => {
    if (path.endsWith("/preview") || areaOf(window.location.host) === "verify" || navigator.webdriver) return;
    const now = Date.now();
    let step: ReturnType<typeof visitStep>;
    try {
      step = visitStep(JSON.parse(localStorage.getItem(KEY) ?? "null"), now, bdToday(now));
      localStorage.setItem(KEY, JSON.stringify(step.next));
    } catch {
      if (countedWithoutStorage) return;
      countedWithoutStorage = true;
      step = visitStep(null, now, bdToday(now));
    }
    if (!step.visit) return;
    const body = JSON.stringify({ first: step.first });
    // text/plain needs no preflight; sendBeacon still goes out if the visitor leaves at once
    if (!navigator.sendBeacon?.("/api/site/visit", new Blob([body], { type: "text/plain" })))
      void fetch("/api/site/visit", { method: "POST", body, keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
