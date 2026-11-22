"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { usePathname } from "next/navigation";

/** When the visitor last saw a page: the head script plays the full intro after 30 minutes away (src/lib/csp.ts). */
const KEY = "gr-door";
const INTRO = ["gr-intro-full", "gr-intro-short"];
const CLOSE_MS = 360; // gr-door-close-* in globals.css
const OPEN_MS = 660; // gr-door-open-* in globals.css, with its delay
const LONGEST_SHUT = 8000; // a page that never arrives: open anyway

/** The right door's opening: the last thing to move (animationend). */
const OPENED = "gr-door-open-r";
const GONE = "gr-door-gone";

type State = "closing" | "opening" | null;

/** The intro the head script started is still on. */
const playing = () => INTRO.some((c) => document.documentElement.classList.contains(c));
/** Hands the doors from the head script's class to this component (or just tidies up after the intro). */
const tidy = () => document.documentElement.classList.remove(...INTRO);

/** Bubbles rising in each door during the full intro: position across the door, size, time and start. */
const BUBBLES = [
  { x: "22%", s: 12, t: 2.4, d: 0.1 },
  { x: "58%", s: 7, t: 2.1, d: 0.45 },
  { x: "80%", s: 16, t: 2.7, d: 0.2 },
];

/**
 * Two doors over the store and the admin panel, with the logo and the shop's line between them. On the first page of a visit they hold a
 * moment (bubbles rising) and open; on a reload they open at once; between pages they close and open again (the logo
 * pulsing while a slow page loads). The head script
 * starts the intro before the first paint and the CSS runs it to the end on its own; this tidies up, lets a tap skip
 * it, and plays the doors on page changes. Nothing is shown to search engines, in a frame, or when the device asks
 * for less motion, nor on the customer form links (/f/...), which open straight to the form.
 *
 * `logo` is the public logo address (the admin panel's own copy only arrives after the page has loaded).
 */
export function DoorIntro({ logo, name }: { logo: string; name: string }) {
  const path = usePathname();
  return path.startsWith("/f/") ? null : <Doors logo={logo} name={name} />;
}

function Doors({ logo, name }: { logo: string; name: string }) {
  // the line's serif, with the page, so it never shows in a fallback font (the store preloads it too)
  for (const f of ["Fraunces-600", "Fraunces-Italic"]) preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>(null);
  const [full, setFull] = useState(false); // keeps the bubbles when a tap skips the full intro
  const now = useRef<State>(null);
  const closedAt = useRef(0);

  useEffect(() => {
    now.current = state;
  }, [state]);

  // the intro may have ended before the page's scripts arrived (slow mobile data)
  useEffect(() => {
    if (ref.current && getComputedStyle(ref.current).visibility === "hidden") tidy();
  }, []);

  // the head script's class goes once React shows the doors itself, so the two never fight
  useLayoutEffect(() => {
    if (state) tidy();
  }, [state]);

  // the time of this page, for the next visit's intro
  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  }, [path]);

  // closing on a link to another page
  useEffect(() => {
    if (window.top !== window) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || still.matches || playing()) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.closest("[data-no-door]")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || to.pathname === location.pathname || to.pathname.startsWith("/api/")) return;
      closedAt.current = performance.now();
      setState("closing");
    };
    window.addEventListener("click", onClick, true); // before the link's own handler navigates
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  // ...and opening once the new page is there and the doors have met
  useEffect(() => {
    if (now.current !== "closing") return;
    const t = window.setTimeout(() => setState("opening"), Math.max(0, CLOSE_MS + 80 - (performance.now() - closedAt.current)));
    return () => window.clearTimeout(t);
  }, [path]);

  // backstops: a link that didn't change the page, or an animation that never reported its end (a hidden tab)
  useEffect(() => {
    if (!state) return;
    const t = window.setTimeout(() => (state === "closing" ? setState("opening") : (setState(null), setFull(false))), state === "closing" ? LONGEST_SHUT : OPEN_MS + 400);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <div
      ref={ref}
      className="gr-door"
      data-state={state ?? undefined}
      data-full={full || undefined}
      aria-hidden="true"
      onClick={() => {
        if (!playing()) return;
        setFull(document.documentElement.classList.contains("gr-intro-full"));
        setState("opening"); // a tap skips the intro
      }}
      onAnimationEnd={(e) => {
        if (e.animationName === GONE && e.target === ref.current) tidy();
        if (e.animationName === OPENED && now.current === "opening") {
          setState(null);
          setFull(false);
        }
      }}
    >
      {(["l", "r"] as const).map((side) => (
        <span key={side} className={`gr-door__half gr-door__half--${side}`}>
          {BUBBLES.map((b, i) => (
            <i key={i} className="gr-door__bubble" style={{ "--x": b.x, "--s": `${b.s}px`, "--t": `${b.t}s`, "--d": `${b.d + (side === "r" ? 0.25 : 0)}s` } as React.CSSProperties} />
          ))}
        </span>
      ))}
      <div className="gr-door__mark">
        <div className="gr-door__logo">
          <span className="gr-door__ring" />
          <span className="gr-door__ring" />
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the shop's logo, the same file the store's header shows
            <img src={logo} alt="" fetchPriority="high" />
          ) : (
            <span className="gr-door__name">{name}</span>
          )}
        </div>
        <p className="gr-door__tag">
          <span>Witness the</span>
          <em>Underwater World</em>
          <span>Through Us</span>
        </p>
      </div>
    </div>
  );
}
