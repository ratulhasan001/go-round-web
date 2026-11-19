"use client";

import { useEffect } from "react";

/**
 * Pauses the moving decorations (grass, the planted tank, bubbles - anything marked `anim-zone`) while they are off
 * screen, so a long page only animates what can be seen. Pausing is plain CSS (`[data-off]` in globals.css); this only
 * watches what is in view, and picks up decorations that appear later (page changes, opened sections).
 */
export function AnimationPauser() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-off", !e.isIntersecting);
      },
      { rootMargin: "120px 0px" },
    );
    const seen = new WeakSet<Element>();
    const scan = () => {
      for (const el of document.querySelectorAll(".anim-zone")) {
        if (seen.has(el)) continue;
        seen.add(el);
        io.observe(el);
      }
    };
    scan();
    let queued = 0;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = window.setTimeout(() => {
        queued = 0;
        scan();
      }, 200);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(queued);
    };
  }, []);
  return null;
}
